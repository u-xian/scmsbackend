"use strict";
// Rejected activations now have status 2. Before, their status stayed 0.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Activations" SET status = 2
      WHERE confirmation_lvl3 IS DISTINCT FROM 1
        AND (confirmation_lvl2 = 2 OR confirmation_lvl3 = 2)
    `);
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE "Activations" SET status = 0 WHERE status = 2`,
    );
  },
};
