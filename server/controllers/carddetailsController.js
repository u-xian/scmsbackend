const _ = require("lodash");
const Cardsdetails = require("../models").Cardsdetails;
const { validate } = require("../models/cardsdetails");

const cardsdetailsCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let carddetails = new Cardsdetails(
      _.pick(req.body, [
        "batch",
        "start_serialnumber",
        "end_serialnumber",
        "pins",
        "cards",
        "denom_id",
        "act_id",
      ])
    );

    carddetails.status = false;
    carddetails = await carddetails.save();

    if (!carddetails) return res.status(404).send("Card details  not found");
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

    let carddetails = await Cardsdetails.findByPk(req.params.carddetailId);
    if (!carddetails) return res.status(404).send("Card details  not found");
    carddetails.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Card details updated!" } });
  },
  updateCarddetailsStatus: async (req, res) => {
    const currentDate = new Date();
    let carddetails = await Cardsdetails.findByPk(req.params.carddetailId);
    if (!carddetails) return res.status(404).send("Card details  not found");
    carddetails.update({ status: true, activated_at: currentDate });
    carddetails = await carddetails.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Card details updated!" } });
  },
  updateStatusByActiv: async (req, res) => {
    const currentDate = new Date();
    const carddetails = await Cardsdetails.update(
      { status: true, activated_at: currentDate },
      {
        where: {
          act_id: req.params.actId,
        },
      }
    );
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Card details updated!" } });
  },
  delete: async (req, res) => {
    let carddetails = await Cardsdetails.findByPk(req.params.carddetailId);
    if (!carddetails) return res.status(404).send("Card details  not found");
    carddetails.destroy();
    res.status(204).send("Card details deleted");
  },

  deleteByActivID: async (req, res) => {
    let carddetails = await Cardsdetails.findOne({
      where: { act_id: req.params.activId },
    });
    if (!carddetails) return res.status(404).send("Card details  not found");
    carddetails.destroy();
    res.status(204).send("Card details deleted");
  },
};

module.exports = cardsdetailsCrontroller;
