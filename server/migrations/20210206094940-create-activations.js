"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Activations", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      actno: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      dealer_id: {
        type: Sequelize.INTEGER,
      },
      confirmation_lvl1: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      confirmation_lvl2: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      confirmation_lvl3: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      userid: {
        type: Sequelize.INTEGER,
      },
      activated_at: {
        type: Sequelize.DATE,
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
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Activations");
  },
};
