"use strict";
const Joi = require("joi");
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Profiles extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Profiles.init(
    {
      profilename: DataTypes.STRING,
      status: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Profiles",
    }
  );
  return Profiles;
};

function validateProfile(profile) {
  const schema = Joi.object({
    profilename: Joi.string().min(2).max(50).required(),
  });

  return schema.validate(profile);
}

module.exports.validate = validateProfile;
