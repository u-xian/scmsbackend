const _ = require("lodash");
const Dealers = require("../models").Dealers;
const { validate } = require("../models/dealers");

const dealersCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const dealer = await Dealers.create({
      dealername: req.body.dealername,
      status: true,
    });

    if (!dealer) return res.status(404).send("Dealer  not found");
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Dealer created!" } });
  },
  list: async (req, res) => {
    const dealers = await Dealers.findAll({ order: [["createdAt", "DESC"]] });
    if (!dealers) return res.status(404).send("Dealers  not found");
    res.status(200).json({ data: dealers });
  },
  listById: async (req, res) => {
    const dealer = await Dealers.findByPk(req.params.dealerId);
    if (!dealer) return res.status(404).send("Dealers  not found");
    res.status(200).json({ data: dealer });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let dealer = await Dealers.findByPk(req.params.dealerId);
    if (!dealer) return res.status(404).send("Dealer  not found");
    dealer.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Dealer updated!" } });
  },
  updateStatus: async (req, res) => {
    let dealer = await Dealers.findByPk(req.params.dealerId);
    if (!dealer) return res.status(404).send("Dealer  not found");
    dealer.update({ status: req.body.status });
    dealer = await dealer.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Dealer updated!" } });
  },
  delete: async (req, res) => {
    let dealer = await Dealers.findByPk(req.params.dealerId);
    if (!dealer) return res.status(404).send("Dealer  not found");
    dealer.destroy();
    res.status(204).send("Dealer deleted");
  },
};

module.exports = dealersCrontroller;
