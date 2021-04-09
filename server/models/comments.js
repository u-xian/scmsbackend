"use strict";
const Joi = require("joi");
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Comments extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Comments.init(
    {
      comment_text: DataTypes.TEXT,
      act_id: DataTypes.INTEGER,
      userid: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Comments",
    }
  );
  return Comments;
};

function validateComment(comment) {
  const schema = Joi.object({
    comment_text: Joi.string().min(2).max(200).required(),
    act_id: Joi.number().integer().required(),
    userid: Joi.number().integer().required(),
  });

  return schema.validate(comment);
}

module.exports.validate = validateComment;
