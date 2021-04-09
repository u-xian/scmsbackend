require("dotenv").config();
const _ = require("lodash");
const Users = require("../models").Users;
const { validate } = require("../models/users");
const encryptingData = require("../services/dataEncrypting");

const usersCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).json({ data: error.details[0].message });

    let user = await Users.findOne({ where: { username: req.body.username } });
    if (user)
      return res.status(200).json({
        data: { status: 0, statusMessage: "User already registered." },
      });

    user = new Users(
      _.pick(req.body, [
        "name",
        "username",
        "email",
        "phone",
        "occupation",
        "location",
        "profil_id",
      ])
    );
    const currentDate = new Date(); // Now
    const expiringDate = currentDate.setDate(currentDate.getDate() + 30);
    const encryptPwd = await encryptingData(process.env.defaultPassword);
    user.password = encryptPwd;
    user.status = true;
    user.first_login_flag = true;
    user.expired_at = expiringDate;
    user = await user.save();
    if (!user) return res.status(404).json({ data: "user  not found" });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "User created!" } });
  },
  list: async (req, res) => {
    const users = await Users.findAll({
      include: ["profiles"],
      attributes: {
        exclude: ["password"],
      },
      order: [["createdAt", "DESC"]],
    });

    if (!users) return res.status(404).send("users  not found");
    res.status(200).json({ data: users });
  },
  listById: async (req, res) => {
    const user = await Users.findByPk(req.params.userId);
    if (!user) return res.status(404).send("users  not found");
    res.status(200).json({ data: user });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let user = await Users.findByPk(req.params.userId);
    if (!user) return res.status(404).send("User  not found");
    user.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "User updated!" } });
  },
  updateStatus: async (req, res) => {
    let user = await Users.findByPk(req.params.userId);
    if (!user) return res.status(404).send("User  not found");
    user.update({ status: req.body.status });
    user = await user.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "User updated!" } });
  },
  delete: async (req, res) => {
    let user = await Users.findByPk(req.params.userId);
    if (!user) return res.status(404).send("user  not found");
    user.destroy();
    res.status(204).send("user deleted");
  },
};

module.exports = usersCrontroller;
