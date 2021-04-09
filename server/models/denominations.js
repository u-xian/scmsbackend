"use strict";
const Joi = require("joi");
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Denominations extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Denominations.init(
    {
      label: DataTypes.STRING,
      pinspercard: DataTypes.INTEGER,
      pinsvalue: DataTypes.INTEGER,
      status: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Denominations",
    }
  );
  return Denominations;
};

function validateDenomination(denomination) {
  const schema = Joi.object({
    label: Joi.string().min(2).max(50).required(),
    pinspercard: Joi.number().integer().required(),
    pinsvalue: Joi.number().integer().required(),
  });

  return schema.validate(denomination);
}

module.exports.validate = validateDenomination;
