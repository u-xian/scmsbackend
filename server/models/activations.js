"use strict";
const { Model } = require("sequelize");
const Joi = require("joi");
module.exports = (sequelize, DataTypes) => {
  class Activations extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Activations.init(
    {
      actno: DataTypes.STRING,
      status: DataTypes.INTEGER,
      dealer_id: DataTypes.INTEGER,
      confirmation_lvl1: DataTypes.INTEGER,
      confirmation_lvl2: DataTypes.INTEGER,
      confirmation_lvl3: DataTypes.INTEGER,
      userid: DataTypes.INTEGER,
      activated_at: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      paranoid: true,
      modelName: "Activations",
    }
  );
  return Activations;
};

function validateActivation(activation) {
  const schema = Joi.object({
    dealer_id: Joi.number().integer().required(),
    userid: Joi.number().integer().required(),
  });

  return schema.validate(activation);
}

module.exports.validate = validateActivation;
