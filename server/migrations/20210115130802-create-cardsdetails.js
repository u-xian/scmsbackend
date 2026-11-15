'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Cardsdetails', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      batch: {
        type: Sequelize.STRING
      },
      start_serialnumber: {
        type: Sequelize.STRING
      },
      end_serialnumber: {
        type: Sequelize.STRING
      },
      pins: {
        type: Sequelize.INTEGER
      },
      cards: {
        type: Sequelize.INTEGER
      },
      denom_id: {
        type: Sequelize.INTEGER
      },
      status: {
        type: Sequelize.BOOLEAN
      },
      act_id: {
        type: Sequelize.INTEGER
      },
      activated_at: {
        type: Sequelize.DATE
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Cardsdetails');
  }
};