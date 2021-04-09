const _ = require("lodash");
const Mailreceivers = require("../models").Mailreceivers;
const { validate } = require("../models/mailreceivers");

const mailreceiversCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const mailreceiver = await Mailreceivers.create({
      names: req.body.names,
      email: req.body.email,
      status: true,
    });

    if (!mailreceiver) return res.status(404).send("Mailreceiver  not found");
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Mailreceiver created!" } });
  },
  list: async (req, res) => {
    const mailreceivers = await Mailreceivers.findAll({
      order: [["createdAt", "DESC"]],
    });
    if (!mailreceivers) return res.status(404).send("Mailreceivers  not found");
    res.status(200).json({ data: mailreceivers });
  },
  listById: async (req, res) => {
    const mailreceiver = await Mailreceivers.findByPk(
      req.params.mailreceiverId
    );
    if (!mailreceiver) return res.status(404).send("Mailreceiver  not found");
    res.status(200).json({ data: mailreceiver });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let mailreceiver = await Mailreceivers.findByPk(req.params.mailreceiverId);
    if (!mailreceiver) return res.status(404).send("Mailreceiver  not found");
    mailreceiver.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Mailreceiver updated!" } });
  },
  updateStatus: async (req, res) => {
    let mailreceiver = await Mailreceivers.findByPk(req.params.mailreceiverId);
    if (!mailreceiver) return res.status(404).send("Mailreceiver  not found");
    mailreceiver.update({ status: req.body.status });
    mailreceiver = await mailreceiver.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Mailreceiver updated!" } });
  },
  delete: async (req, res) => {
    let mailreceiver = await Mailreceivers.findByPk(req.params.mailreceiverId);
    if (!mailreceiver) return res.status(404).send("Mailreceiver  not found");
    mailreceiver.destroy();
    res.status(204).send("Mailreceiver deleted");
  },
};

module.exports = mailreceiversCrontroller;
