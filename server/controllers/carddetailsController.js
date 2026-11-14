const _ = require("lodash");
const Cardsdetails = require("../models").Cardsdetails;
const { validate } = require("../models/cardsdetails");
const { withPendingActivation } = require("../services/activationWorkflow");
const {
  findOverlappingRange,
  describeOverlap,
} = require("../services/cardRanges");
const { catchAsyncController } = require("../utils/catchAsync");

/*
  Card ranges belong to an activation. They can be added, changed or removed
  only while that activation is pending (waiting for level 2), by its
  submitter or an admin (see server/services/activationWorkflow.js).
  Ranges of the same batch never overlap. Cards are activated only by the
  final approval of their activation.
*/
const RANGE_FIELDS = [
  "batch",
  "start_serialnumber",
  "end_serialnumber",
  "pins",
  "cards",
  "denom_id",
  "act_id",
];

// Returns the overlap error message, or null when the range is free.
async function overlapMessage(range, transaction, excludeId = null) {
  const overlap = await findOverlappingRange(
    {
      batch: range.batch,
      start: range.start_serialnumber,
      end: range.end_serialnumber,
      excludeId,
    },
    { transaction, lockBatch: true },
  );
  return overlap ? describeOverlap(range, overlap) : null;
}

const cardsdetailsCrontroller = {
  create: async (req, res) => {
    const { error, value } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const overlap = await withPendingActivation(
      value.act_id,
      req.user,
      async (activation, transaction) => {
        const message = await overlapMessage(value, transaction);
        if (message) return message;

        await Cardsdetails.create(
          { ..._.pick(value, RANGE_FIELDS), status: false },
          { transaction },
        );
        return null;
      },
    );

    if (overlap) return res.status(409).json({ error: overlap });
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
    const { error, value } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const carddetails = await Cardsdetails.findByPk(req.params.carddetailId);
    if (!carddetails) return res.status(404).send("Card details  not found");
    if (value.act_id !== carddetails.act_id)
      return res
        .status(409)
        .send("Card details cannot be moved to another activation");

    const overlap = await withPendingActivation(
      carddetails.act_id,
      req.user,
      async (activation, transaction) => {
        const message = await overlapMessage(
          value,
          transaction,
          carddetails.id,
        );
        if (message) return message;

        await carddetails.update(_.pick(value, RANGE_FIELDS), { transaction });
        return null;
      },
    );

    if (overlap) return res.status(409).json({ error: overlap });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Card details updated!" } });
  },
  delete: async (req, res) => {
    const carddetails = await Cardsdetails.findByPk(req.params.carddetailId);
    if (!carddetails) return res.status(404).send("Card details  not found");
    await withPendingActivation(
      carddetails.act_id,
      req.user,
      (activation, transaction) => carddetails.destroy({ transaction }),
    );
    res.status(204).send("Card details deleted");
  },

  deleteByActivID: async (req, res) => {
    const deleted = await withPendingActivation(
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
