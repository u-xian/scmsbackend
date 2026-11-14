require("dotenv").config();
const _ = require("lodash");
const Joi = require("joi");
const { Op, literal } = require("sequelize");
const Users = require("../models").Users;
const { PROFILES } = require("../middleware/requireProfile");
const { validate } = require("../models/users");
const encryptingData = require("../services/dataEncrypting");
const { catchAsyncController } = require("../utils/catchAsync");

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
      ]),
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

    // A user who is not an admin may only edit their own details, and may
    // not change their profile (this is how they could become admin).
    if (req.user.profileId !== PROFILES.ADMIN) {
      if (user.id !== req.user.userid)
        return res
          .status(403)
          .send("Access denied. You can only edit your own account.");
      if (Number(req.body.profil_id) !== user.profil_id)
        return res
          .status(403)
          .send("Access denied. Only an admin can change a profile.");
    }

    // Two accounts with the same username would make login ambiguous.
    const sameUsername = await Users.findOne({
      where: { username: req.body.username, id: { [Op.ne]: user.id } },
    });
    if (sameUsername) return res.status(409).send("Username already taken");

    await user.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "User updated!" } });
  },
  updateStatus: async (req, res) => {
    const { error, value } = Joi.object({
      status: Joi.boolean().required(),
    }).validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let user = await Users.findByPk(req.params.userId);
    if (!user) return res.status(404).send("User  not found");
    if (user.id === req.user.userid && value.status === false)
      return res.status(409).send("You cannot disable your own account");
    // Disabling also ends the user's sessions for good: if the account is
    // enabled again, tokens given before stay invalid.
    await user.update(
      value.status
        ? { status: true }
        : { status: false, token_version: literal('"token_version" + 1') },
    );
    user = await user.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "User updated!" } });
  },
  delete: async (req, res) => {
    let user = await Users.findByPk(req.params.userId);
    if (!user) return res.status(404).send("user  not found");
    if (user.id === req.user.userid)
      return res.status(409).send("You cannot delete your own account");
    await user.destroy();
    res.status(204).send("user deleted");
  },
};

module.exports = catchAsyncController(usersCrontroller);
