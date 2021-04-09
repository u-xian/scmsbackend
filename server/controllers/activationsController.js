const _ = require("lodash");
const { Op } = require("sequelize");
const Activations = require("../models").Activations;
const Cardsdetails = require("../models").Cardsdetails;
const Dealers = require("../models").Dealers;
const Users = require("../models").Users;
const { validate } = require("../models/activations");
const generateActivationNumber = require("../services/generateActivationNumber");

const activationsCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let activation = new Activations(_.pick(req.body, ["dealer_id", "userid"]));
    Activations.addHook("beforeSave", (activation, options) => {
      activation.actno = generateActivationNumber();
    });
    activation = await activation.save();

    if (!activation) return res.status(404).send("Activation  not found");

    res.status(200).json({
      data: {
        activId: activation.id,
        status: 1,
        statusMessage: "Activation created!",
      },
    });
  },
  list: async (req, res) => {
    const profileID = Number(req.params.profileId);
    let activData = {};

    const lvl3data = {
      [Op.or]: [{ confirmation_lvl2: 0 }, { confirmation_lvl3: 2 }],
    };

    const lvl4data = {
      confirmation_lvl1: 1,
      confirmation_lvl2: 1,
      confirmation_lvl3: 0,
    };

    //Pending on Level 2
    if (profileID === 3) {
      activData = lvl3data;
    }
    //Pending on Level 3
    if (profileID === 4) {
      activData = lvl4data;
    }
    //all activations
    if (profileID === 0) {
      activData;
    }

    const activations = await Activations.findAll({
      //include: ["agents", "dealers"],
      where: activData,
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
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    if (!activations) return res.status(404).send("Activations  not found");
    res.status(200).json({ data: activations });
  },
  listById: async (req, res) => {
    const activation = await Activations.findByPk(req.params.activationId);
    if (!activation) return res.status(404).send("Activation  not found");
    res.status(200).json({ data: activation });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let activation = await Activations.findByPk(req.params.activationId);
    if (!activation) return res.status(404).send("Activation  not found");
    activation.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Activation updated!" } });
  },
  updateConfirmation: async (req, res) => {
    /*  0 -> not approved
       1 -> approved
       2 -> rejected */

    const currentDate = new Date();
    const level = Number(req.body.level);
    const confirmStatus = req.body.confirmStatus === false ? 1 : 2;
    let activation = await Activations.findByPk(req.params.activationId);
    if (!activation) return res.status(404).send("Activation  not found");
    if (level === 3) {
      activation.update({ confirmation_lvl2: confirmStatus });
    }
    if (level === 4 && confirmStatus === 2) {
      activation.update({ confirmation_lvl3: confirmStatus });
    }
    if (level === 4 && confirmStatus === 1) {
      const currentDate = new Date();
      const carddetails = await Cardsdetails.update(
        { status: true, activated_at: currentDate },
        {
          where: {
            act_id: req.params.activationId,
          },
        }
      );
      activation.update({
        status: confirmStatus,
        confirmation_lvl3: confirmStatus,
        activated_at: currentDate,
      });
    }
    activation = await activation.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Activation updated!" } });
  },
  updateStatus: async (req, res) => {
    let activation = await Activations.findByPk(req.params.activationId);
    if (!activation) return res.status(404).send("Activation  not found");
    activation.update({ status: req.body.status });
    activation = await activation.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Activation updated!" } });
  },
  delete: async (req, res) => {
    let activation = await Activations.findByPk(req.params.activationId);
    if (!activation) return res.status(404).send("Activation  not found");
    activation.destroy();
    res.status(204).send("Activation deleted");
  },
};

module.exports = activationsCrontroller;
