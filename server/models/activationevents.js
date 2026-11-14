"use strict";
const { Model } = require("sequelize");

// Actions recorded in the history of an activation
const ACTIONS = Object.freeze({
  CREATED: "created",
  SUBMITTED: "submitted",
  RESUBMITTED: "resubmitted",
  APPROVED: "approved",
  REJECTED: "rejected",
});

module.exports = (sequelize, DataTypes) => {
  class ActivationEvents extends Model {}
  ActivationEvents.init(
    {
      act_id: { type: DataTypes.INTEGER, allowNull: false },
      userid: DataTypes.INTEGER,
      level: { type: DataTypes.INTEGER, allowNull: false },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isIn: [Object.values(ACTIONS)] },
      },
      reason: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "ActivationEvents",
    },
  );
  return ActivationEvents;
};

module.exports.ACTIONS = ACTIONS;
