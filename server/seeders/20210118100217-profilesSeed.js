"use strict";

const profilesdata = require("./profilesData.json");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let profiles = [];
    profilesdata.map((p) => {
      profiles.push({
        profilename: p.profilename,
        status: p.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    return await queryInterface.bulkInsert("Profiles", profiles);
  },

  down: async (queryInterface, Sequelize) => {
    return await queryInterface.bulkDelete("Profiles", null, {});
  },
};
