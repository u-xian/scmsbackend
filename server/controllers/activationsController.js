const Joi = require("joi");
const Activations = require("../models").Activations;
const ActivationEvents = require("../models").ActivationEvents;
const Cardsdetails = require("../models").Cardsdetails;
const Dealers = require("../models").Dealers;
const Users = require("../models").Users;
const Denominations = require("../models").Denominations;
const { validate } = require("../models/activations");
const { STATES, WHERE_STATE } = require("../services/activationState");
const workflow = require("../services/activationWorkflow");
const { catchAsyncController } = require("../utils/catchAsync");

// History of the activation, oldest first, with the name of each user.
const eventsInclude = {
  model: ActivationEvents,
  as: "events",
  separate: true,
  order: [["createdAt", "ASC"], ["id", "ASC"]],
  include: [{ model: Users, as: "user", attributes: ["id", "name"] }],
};

const validateReject = (body) =>
  Joi.object({
    reason: Joi.string().trim().min(5).max(1000).required().messages({
      "any.required": "A reason is required to reject an activation",
      "string.empty": "A reason is required to reject an activation",
      "string.min": "The reason must have at least 5 characters",
    }),
  }).validate(body);

const validateResubmit = (body) =>
  Joi.object({
    comment: Joi.string().trim().max(1000).allow(""),
  }).validate(body);

const done = (res, statusMessage, activation) =>
  res.status(200).json({
    data: {
      activId: activation.id,
      state: activation.state,
      status: 1,
      statusMessage,
    },
  });

const activationsCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const activation = await workflow.submit(req.body, req.user);
    done(res, "Activation created!", activation);
  },
  /*
    profileId 3 (accounting): activations waiting for level 2
    profileId 4 (billing):    activations waiting for level 3
    anything else:            all activations
  */
  list: async (req, res) => {
    const profileID = Number(req.params.profileId);
    const where =
      {
        3: WHERE_STATE[STATES.PENDING_LEVEL2],
        4: WHERE_STATE[STATES.PENDING_LEVEL3],
      }[profileID] || {};

    const activations = await Activations.findAll({
      where,
      include: [
        {
          model: Users,
          as: "agents",
          attributes: ["id", "name"],
        },
        {
          model: Dealers,
          as: "dealers",
          attributes: ["id", "dealername"],
        },
        {
          model: Cardsdetails,
          as: "cardsdetails",
          include: [
            {
              model: Denominations,
              as: "denominations",
              attributes: ["id", "label"],
            },
          ],
        },
        eventsInclude,
      ],
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json({ data: activations });
  },
  listById: async (req, res) => {
    const activation = await Activations.findByPk(req.params.activationId, {
      include: [eventsInclude],
    });
    if (!activation) return res.status(404).send("Activation  not found");
    res.status(200).json({ data: activation });
  },
  // Only the dealer can change, and only while the activation is pending.
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    await workflow.withPendingActivation(
      req.params.activationId,
      req.user,
      (activation, transaction) =>
        activation.update({ dealer_id: req.body.dealer_id }, { transaction }),
    );
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Activation updated!" } });
  },
  approve: async (req, res) => {
    const activation = await workflow.approve(
      req.params.activationId,
      req.user,
    );
    done(res, "Activation approved!", activation);
  },
  reject: async (req, res) => {
    const { error, value } = validateReject(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const activation = await workflow.reject(
      req.params.activationId,
      req.user,
      value.reason,
    );
    done(res, "Activation rejected!", activation);
  },
  resubmit: async (req, res) => {
    const { error, value } = validateResubmit(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const activation = await workflow.resubmit(
      req.params.activationId,
      req.user,
      value.comment,
    );
    done(res, "Activation sent again!", activation);
  },
  // Pending or rejected only; its card ranges are deleted with it.
  delete: async (req, res) => {
    await workflow.deleteActivation(req.params.activationId, req.user);
    res.status(204).send("Activation deleted");
  },
};

module.exports = catchAsyncController(activationsCrontroller);
