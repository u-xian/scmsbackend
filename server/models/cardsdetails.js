"use strict";
const Joi = require("joi");
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Cardsdetails extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Cardsdetails.init(
    {
      batch: DataTypes.STRING,
      start_serialnumber: DataTypes.STRING,
      end_serialnumber: DataTypes.STRING,
      pins: DataTypes.INTEGER,
      cards: DataTypes.INTEGER,
      denom_id: DataTypes.INTEGER,
      status: DataTypes.BOOLEAN,
      act_id: DataTypes.INTEGER,
      activated_at: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      paranoid: true,
      modelName: "Cardsdetails",
    }
  );
  return Cardsdetails;
};

function validateCarddetails(carddetails) {
  const serialNumber = (label) =>
    Joi.string()
      .trim()
      .min(2)
      .max(50)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        "string.pattern.base": `${label} must contain digits only`,
      });

  const schema = Joi.object({
    batch: Joi.string().trim().min(2).max(50).required(),
    start_serialnumber: serialNumber("start_serialnumber"),
    end_serialnumber: serialNumber("end_serialnumber"),
    pins: Joi.number().integer().required(),
    cards: Joi.number().integer().required(),
    denom_id: Joi.number().integer().required(),
    act_id: Joi.number().integer().required(),
  }).custom((range, helpers) => {
    if (BigInt(range.start_serialnumber) > BigInt(range.end_serialnumber))
      return helpers.message(
        "start_serialnumber must not be greater than end_serialnumber",
      );
    return range;
  });

  return schema.validate(carddetails);
}

module.exports.validate = validateCarddetails;
