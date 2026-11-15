"use strict";
const Joi = require("joi");
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class AccessMenu extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  AccessMenu.init(
    {
      pathname: DataTypes.STRING,
      description: DataTypes.STRING,
      accesslevel: DataTypes.ARRAY(DataTypes.INTEGER),
      menuicon: DataTypes.STRING,
      defaultmenuitem: DataTypes.BOOLEAN,
      status: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "AccessMenu",
    }
  );
  return AccessMenu;
};

function validateMenu(menu) {
  const schema = Joi.object({
    pathname: Joi.string().min(2).max(50).required(),
    description: Joi.string().min(2).max(50).required(),
    accesslevel: Joi.array().items(Joi.number().integer()).required(),
    menuicon: Joi.string().min(2).max(50).required(),
    defaultmenuitem: Joi.boolean().required(),
  });

  return schema.validate(menu);
}

module.exports.validate = validateMenu;
