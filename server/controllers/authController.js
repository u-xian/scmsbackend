const Joi = require("joi");
const bcrypt = require("bcrypt");
const _ = require("lodash");
const Users = require("../models").Users;
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const AccessMenu = require("../models").AccessMenu;
const generateAuthToken = require("../services/generateAuthenticationToken");
const encryptingData = require("../services/dataEncrypting");
const { catchAsyncController } = require("../utils/catchAsync");

const PASSWORD_VALIDITY_DAYS = 30;

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

    let user = await Users.scope("withPassword").findOne({
      where: { username: req.body.username },
    });
    if (!user)
      return res.status(401).json({
        status: statusResponse,
        statusMessage: "Invalid username!",
      });

    if (!(await passwordMatches(req.body.password, user)))
      return res.status(401).json({
        status: statusResponse,
        statusMessage: "Invalid password!",
      });

    if (user.status !== true)
      return res.status(403).json({
        status: statusResponse,
        statusMessage: "Account disabled. Contact your administrator.",
      });

    if (user.first_login_flag === true) {
      return res.status(200).json({
        status: 2,
        statusMessage:
          "Welcome, this is your first login, change password to continue",
        userId: user.id,
      });
    }

    // No expiry date is treated as expired: the user must set a new password.
    if (!user.expired_at || currentDate.getTime() > user.expired_at.getTime()) {
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
      resetType: 4,
    };
    res
      .status(200)
      .json({ status: 1, statusMessage: generateAuthToken(userData) });
  },
  /*
    Public route (no token): used for the first login (status 2), for an
    expired password (status 3) and for a normal change (resetType 4).
    The user proves who they are with their current password.
    Body: { oldpassword, newpassword, confirmpassword, resetType? }
    resetType is accepted for compatibility but no longer changes anything:
    every successful change clears the first login flag and sets a new
    expiry date 30 days ahead.
  */
  resetPassword: async (req, res) => {
    const { error } = validatePasswordChange(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const user = await Users.scope("withPassword").findByPk(req.params.userId);
    if (!user) return res.status(404).send("user  not found");

    if (!(await passwordMatches(req.body.oldpassword, user)))
      return res.status(401).json({
        status: 0,
        statusMessage: "Invalid password!",
      });

    if (user.status !== true)
      return res.status(403).json({
        status: 0,
        statusMessage: "Account disabled. Contact your administrator.",
      });

    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + PASSWORD_VALIDITY_DAYS);

    await user.update({
      password: await encryptingData(req.body.newpassword),
      first_login_flag: false,
      expired_at: expiringDate,
    });

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

function validatePasswordChange(req) {
  const schema = Joi.object({
    oldpassword: Joi.string().max(255).required(),
    newpassword: Joi.string()
      .min(5)
      .max(255)
      .invalid(Joi.ref("oldpassword"))
      .required()
      .messages({
        "any.invalid": "The new password must be different from the old one",
      }),
    confirmpassword: Joi.string()
      .valid(Joi.ref("newpassword"))
      .required()
      .messages({ "any.only": "The passwords do not match" }),
    resetType: Joi.number().integer().valid(2, 3, 4),
  });

  return schema.validate(req);
}

// bcrypt.compare throws when the stored hash is empty: treat it as no match.
async function passwordMatches(password, user) {
  if (!user.password) return false;
  return bcrypt.compare(password, user.password);
}

module.exports = catchAsyncController(authCrontroller);
