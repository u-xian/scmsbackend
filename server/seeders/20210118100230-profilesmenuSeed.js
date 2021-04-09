"use strict";
const menudata = require("./profilesmenuData.json");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let menu = [];
    menudata.map((p) => {
      menu.push({
        menuname: p.menuname,
        pathname: p.pathname,
        description: p.description,
        status: p.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    return await queryInterface.bulkInsert("Profilemenus", menu);
  },

  down: async (queryInterface, Sequelize) => {
    return await queryInterface.bulkDelete("Profilemenus", null, {});
  },
};
