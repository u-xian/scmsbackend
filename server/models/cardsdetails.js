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
  const schema = Joi.object({
    batch: Joi.string().min(2).max(50).required(),
    start_serialnumber: Joi.string().min(2).max(50).required(),
    end_serialnumber: Joi.string().min(2).max(50).required(),
    pins: Joi.number().integer().required(),
    cards: Joi.number().integer().required(),
    denom_id: Joi.number().integer().required(),
    act_id: Joi.number().integer().required(),
  });

  return schema.validate(carddetails);
}

module.exports.validate = validateCarddetails;
