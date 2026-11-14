"use strict";
const { Model } = require("sequelize");
const Joi = require("joi");
const generateActivationNumber = require("../services/generateActivationNumber");
const { stateOf } = require("../services/activationState");
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
      // Not stored: pending_level2, pending_level3, approved or rejected
      state: {
        type: DataTypes.VIRTUAL,
        get() {
          return stateOf(this);
        },
      },
    },
    {
      sequelize,
      paranoid: true,
      modelName: "Activations",
      hooks: {
        beforeCreate: (activation) => {
          activation.actno = generateActivationNumber();
        },
      },
    },
  );
  return Activations;
};

function validateActivation(activation) {
  const schema = Joi.object({
    dealer_id: Joi.number().integer().required(),
    // Accepted for compatibility but ignored: the submitter is the user of
    // the token.
    userid: Joi.number().integer(),
  });

  return schema.validate(activation);
}

module.exports.validate = validateActivation;
