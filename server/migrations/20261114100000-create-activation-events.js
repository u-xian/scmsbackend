"use strict";
// History of an activation: submissions, approvals and rejections (with the
// reason). Rows are only added, never changed.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ActivationEvents", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      act_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: "Activations", key: "id" },
        onDelete: "CASCADE",
      },
      userid: {
        type: Sequelize.INTEGER,
      },
      level: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      action: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      reason: {
        type: Sequelize.TEXT,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex("ActivationEvents", ["act_id"]);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("ActivationEvents");
  },
};
