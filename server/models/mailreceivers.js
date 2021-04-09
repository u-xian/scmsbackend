"use strict";
const Joi = require("joi");
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Mailreceivers extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mailreceivers.init(
    {
      names: DataTypes.STRING,
      email: DataTypes.STRING,
      status: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Mailreceivers",
    }
  );
  return Mailreceivers;
};

function validateMailreceiver(mailreceiver) {
  const schema = Joi.object({
    names: Joi.string().min(2).max(50).required(),
    email: Joi.string().min(2).max(50).required(),
  });

  return schema.validate(mailreceiver);
}

module.exports.validate = validateMailreceiver;
