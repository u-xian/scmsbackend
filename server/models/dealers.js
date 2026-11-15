"use strict";
const Joi = require("joi");
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Dealers extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Dealers.init(
    {
      dealername: DataTypes.STRING,
      status: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Dealers",
    }
  );
  return Dealers;
};

function validateDealers(dealer) {
  const schema = Joi.object({
    dealername: Joi.string().min(2).max(50).required(),
  });

  return schema.validate(dealer);
}

module.exports.validate = validateDealers;
