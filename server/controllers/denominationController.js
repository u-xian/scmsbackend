const _ = require("lodash");
const Denominations = require("../models").Denominations;
const { validate } = require("../models/denominations");

const denominationsCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const denomination = await Denominations.create({
      label: req.body.label,
      pinspercard: req.body.pinspercard,
      pinsvalue: req.body.pinsvalue,
      status: true,
    });

    if (!denomination) return res.status(404).send("Denomination  not found");
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Denomination created!" } });
  },
  list: async (req, res) => {
    const denominations = await Denominations.findAll({
      order: [["pinsvalue", "ASC"]],
    });
    if (!denominations) return res.status(404).send("Denominations  not found");
    res.status(200).json({ data: denominations });
  },
  listById: async (req, res) => {
    const denomination = await Denominations.findByPk(
      req.params.denominationId
    );
    if (!denomination) return res.status(404).send("Denomination  not found");
    res.status(200).json({ data: denomination });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let denomination = await Denominations.findByPk(req.params.denominationId);
    if (!denomination) return res.status(404).send("Denomination  not found");
    denomination.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Denomination updated!" } });
  },
  updateStatus: async (req, res) => {
    let denomination = await Denominations.findByPk(req.params.denominationId);
    if (!denomination) return res.status(404).send("Denomination  not found");
    denomination.update({ status: req.body.status });
    denomination = await denomination.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Denomination updated!" } });
  },
  delete: async (req, res) => {
    let denomination = await Denominations.findByPk(req.params.denominationId);
    if (!denomination) return res.status(404).send("Denomination  not found");
    denomination.destroy();
    res.status(204).send("Denomination deleted");
  },
};

module.exports = denominationsCrontroller;
