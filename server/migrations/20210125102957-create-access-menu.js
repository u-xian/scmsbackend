"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("AccessMenus", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      pathname: {
        type: Sequelize.STRING,
      },
      description: {
        type: Sequelize.STRING,
      },
      accesslevel: {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
      },
      menuicon: {
        type: Sequelize.STRING,
      },
      defaultmenuitem: {
        type: Sequelize.BOOLEAN,
      },
      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
    await queryInterface.dropTable("AccessMenus");
  },
};
