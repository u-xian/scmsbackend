"use strict";

const menudata = require("./profileaccessData.json");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let menu = [];
    menudata.map((p) => {
      menu.push({
        profil: p.profil,
        profile_action: p.function,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    return await queryInterface.bulkInsert("Profileaxs", menu);
  },

  down: async (queryInterface, Sequelize) => {
    return await queryInterface.bulkDelete("Profileaxs", null, {});
  },
};
