"use strict";
const Joi = require("joi");
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Users extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Users.init(
    {
      name: DataTypes.STRING,
      username: DataTypes.STRING,
      password: DataTypes.STRING,
      status: DataTypes.BOOLEAN,
      phone: DataTypes.STRING,
      email: DataTypes.STRING,
      occupation: DataTypes.STRING,
      location: DataTypes.STRING,
      first_login_flag: DataTypes.BOOLEAN,
      profil_id: DataTypes.INTEGER,
      expired_at: DataTypes.DATE,
      // Increased at each password change: tokens with an older value are
      // refused (see middleware/auth.js).
      token_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "Users",
      // Never return the password hash unless asked for explicitly with
      // Users.scope("withPassword") (login and password change only).
      // token_version is internal too.
      defaultScope: {
        attributes: { exclude: ["password", "token_version"] },
      },
      scopes: {
        withPassword: {
          attributes: { include: ["password"] },
        },
      },
    }
  );
  return Users;
};

function validateUser(user) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    username: Joi.string().min(2).max(50).required(),
    phone: Joi.string().min(2).max(50).required(),
    email: Joi.string().min(2).max(50).required(),
    occupation: Joi.string().min(2).max(50).required(),
    location: Joi.string().min(2).max(50).required(),
    profil_id: Joi.number().integer().required(),
  });

  return schema.validate(user);
}

module.exports.validate = validateUser;
