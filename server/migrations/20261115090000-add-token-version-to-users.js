"use strict";
// Every token carries the token_version of its user. Changing the password
// increases it, so all tokens given before stop working at once.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Users", "token_version", {
      allowNull: false,
      defaultValue: 0,
      type: Sequelize.INTEGER,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("Users", "token_version");
  },
};
