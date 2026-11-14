const _ = require("lodash");
const Cardsdetails = require("../models").Cardsdetails;
const { validate } = require("../models/cardsdetails");
const { withEditableActivation } = require("../services/activationWorkflow");
const { catchAsyncController } = require("../utils/catchAsync");

/*
  Card details belong to an activation. They can be added, changed or
  removed only while that activation can be changed (see
  server/services/activationWorkflow.js). Cards are activated only by the
  final approval of their activation.
*/
const cardsdetailsCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const created = await withEditableActivation(
      req.body.act_id,
      req.user,
      async (activation, transaction) => {
        const card = await Cardsdetails.findOne({
          where: {
            batch: req.body.batch,
            start_serialnumber: req.body.start_serialnumber,
            end_serialnumber: req.body.end_serialnumber,
          },
          transaction,
        });
        if (card) return false;

        const carddetails = Cardsdetails.build(
          _.pick(req.body, [
            "batch",
            "start_serialnumber",
            "end_serialnumber",
            "pins",
            "cards",
            "denom_id",
            "act_id",
          ]),
        );
        carddetails.status = false;
        await carddetails.save({ transaction });
        return true;
      },
    );

    if (!created) return res.status(404).json({ error: "Card already exists" });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Card details created!" } });
  },
  list: async (req, res) => {
    const cardsdetails = await Cardsdetails.findAll({
      include: ["denominations"],
      order: [["createdAt", "DESC"]],
    });
    if (!cardsdetails) return res.status(404).send("Cards details  not found");
    res.status(200).json({ data: cardsdetails });
  },

  listById: async (req, res) => {
    const carddetails = await Cardsdetails.findByPk(req.params.carddetailId);
    if (!carddetails) return res.status(404).send("Card details  not found");
    res.status(200).json({ data: carddetails });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const carddetails = await Cardsdetails.findByPk(req.params.carddetailId);
    if (!carddetails) return res.status(404).send("Card details  not found");
    if (Number(req.body.act_id) !== carddetails.act_id)
      return res
        .status(409)
        .send("Card details cannot be moved to another activation");

    await withEditableActivation(
      carddetails.act_id,
      req.user,
      (activation, transaction) =>
        carddetails.update(req.body, {
          fields: Object.keys(req.body),
          transaction,
        }),
    );
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Card details updated!" } });
  },
  delete: async (req, res) => {
    const carddetails = await Cardsdetails.findByPk(req.params.carddetailId);
    if (!carddetails) return res.status(404).send("Card details  not found");
    await withEditableActivation(
      carddetails.act_id,
      req.user,
      (activation, transaction) => carddetails.destroy({ transaction }),
    );
    res.status(204).send("Card details deleted");
  },

  deleteByActivID: async (req, res) => {
    const deleted = await withEditableActivation(
      req.params.activId,
      req.user,
      async (activation, transaction) => {
        const carddetails = await Cardsdetails.findOne({
          where: { act_id: activation.id },
          transaction,
        });
        if (!carddetails) return false;
        await carddetails.destroy({ transaction });
        return true;
      },
    );
    if (!deleted) return res.status(404).send("Card details  not found");
    res.status(204).send("Card details deleted");
  },
};

module.exports = catchAsyncController(cardsdetailsCrontroller);
