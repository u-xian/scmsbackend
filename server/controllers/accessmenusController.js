const _ = require("lodash");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const AccessMenu = require("../models").AccessMenu;
const { validate } = require("../models/accessmenu");

const accessmenusCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const accessmenu = await AccessMenu.create({
      pathname: req.body.pathname,
      description: req.body.description,
      accesslevel: req.body.accesslevel,
      menuicon: req.body.menuicon,
      defaultmenuitem: req.body.defaultmenuitem,
    });

    if (!accessmenu) return res.status(404).send("Access Menu  not found");
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Access Menu created!" } });
  },
  list: async (req, res) => {
    const accessmenu = await AccessMenu.findAll();
    if (!accessmenu) return res.status(404).send("Access Menu  not found");
    res.status(200).json({ data: accessmenu });
  },
  listById: async (req, res) => {
    const accessmenu = await AccessMenu.findByPk(req.params.accessmenuId);
    if (!accessmenu) return res.status(404).send("Access Menu  not found");
    res.status(200).json({ data: accessmenu });
  },
  listMenu: async (req, res) => {
    const menus = await AccessMenu.findAll({
      where: {
        accesslevel: { [Op.contains]: [Number(req.params.profilelevelId)] },
        status: true,
      },
    });

    if (!menus) return res.status(404).send("Menu  not found");
    res.status(200).json({ data: menus });
  },
  listDefaultMenu: async (req, res) => {
    const menus = await AccessMenu.findAll({
      where: {
        accesslevel: { [Op.contains]: [Number(req.params.profilelevelId)] },
        status: true,
        defaultmenuitem: true,
      },
    });

    if (!menus) return res.status(404).send("Menu  not found");
    res.status(200).json({ data: menus });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let accessmenu = await AccessMenu.findByPk(req.params.accessmenuId);
    if (!accessmenu) return res.status(404).send("Access Menu  not found");
    accessmenu.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Access Menu updated!" } });
  },
  updateStatus: async (req, res) => {
    let accessmenu = await AccessMenu.findByPk(req.params.accessmenuId);
    if (!accessmenu) return res.status(404).send("Access Menu  not found");
    accessmenu.update({ status: req.body.status });
    accessmenu = await accessmenu.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Access Menu updated!" } });
  },
  delete: async (req, res) => {
    let accessmenu = await AccessMenu.findByPk(req.params.accessmenuId);
    if (!accessmenu) return res.status(404).send("Access Menu  not found");
    accessmenu.destroy();
    res.status(204).send("Access Menu deleted");
  },
};

module.exports = accessmenusCrontroller;
