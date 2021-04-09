const Joi = require("joi");
const bcrypt = require("bcrypt");
const _ = require("lodash");
const Users = require("../models").Users;
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const AccessMenu = require("../models").AccessMenu;
const generateAuthToken = require("../services/generateAuthenticationToken");
const encryptingData = require("../services/dataEncrypting");

const authCrontroller = {
  /*
    responseStatus : 0 --> Invalid username or password
    responseStatus : 1 --> Login successful
    responseStatus : 2 --> First Login
    responseStatus : 3 --> Password expired
  */
  auth: async (req, res) => {
    let response = "";
    let statusResponse = 0;
    const currentDate = new Date();
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let user = await Users.findOne({ where: { username: req.body.username } });
    if (!user)
      return res.status(200).json({
        status: statusResponse,
        statusMessage: "Invalid username or password!",
      });

    const validatePassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!validatePassword)
      return res.status(200).json({
        status: statusResponse,
        statusMessage: "Invalid username or password!",
      });
    if (user.first_login_flag === true) {
      return res.status(200).json({
        status: 2,
        statusMessage:
          "Welcome, this is your first login, change password to continue",
        userId: user.id,
      });
    }

    if (currentDate.getTime() > user.expired_at.getTime()) {
      return res.status(200).json({
        status: 3,
        statusMessage: "Password expired. Please click below change it ",
        userId: user.id,
      });
    }

    const menus = await AccessMenu.findAll({
      where: {
        accesslevel: { [Op.contains]: [Number(user.profil_id)] },
        status: true,
      },
      attributes: ["id", "pathname", "description", "menuicon"],
    });

    const defaultmenu = await AccessMenu.findOne({
      where: {
        accesslevel: { [Op.contains]: [Number(user.profil_id)] },
        status: true,
        defaultmenuitem: true,
      },
      attributes: ["pathname"],
    });

    const userData = {
      userid: user.id,
      profileId: user.profil_id,
      username: user.username,
      first_login_flag: user.first_login_flag,
      usermenus: menus,
      userdefaultmenu: defaultmenu,
      resetType : 4,
    };
    res
      .status(200)
      .json({ status: 1, statusMessage: generateAuthToken(userData) });
  },
  resetPassword: async (req, res) => {
    let user = await Users.findByPk(req.params.userId);
    if (!user) return res.status(404).send("user  not found");
    const resetType = Number(req.body.resetType);
    const encryptPwd = await encryptingData(req.body.confirmpassword);
    const currentDate = new Date(); // Now
    const expiringDate = currentDate.setDate(currentDate.getDate() + 30);

    const firstLoginData = {
      first_login_flag: false,
      password: encryptPwd,
    };

    const expirationData = {
      expired_at: expiringDate,
      password: encryptPwd,
    };
    const normalResetData = {
      password: encryptPwd,
    };
    if (resetType === 2) user.update(firstLoginData);
    if (resetType === 3) user.update(expirationData);
    if (resetType === 4) user.update(normalResetData);

    user = await user.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "User updated!" } });
  },
};

function validate(req) {
  const schema = Joi.object({
    username: Joi.string().min(5).max(255).required(),
    password: Joi.string().min(5).max(255).required(),
  });

  return schema.validate(req);
}

module.exports = authCrontroller;
