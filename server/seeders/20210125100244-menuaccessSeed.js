"use strict";

const menuaccessdata = require("./menuaccessData.json");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let menus = [];
    menuaccessdata.map((p) => {
      menus.push({
        pathname: p.pathname,
        description: p.description,
        accesslevel: p.accessLevel,
        menuicon: p.menuIcon,
        defaultmenuitem: p.defaultMenuItem,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    return await queryInterface.bulkInsert("AccessMenus", menus);
  },

  down: async (queryInterface, Sequelize) => {
    return await queryInterface.bulkDelete("AccessMenus", null, {});
  },
};
