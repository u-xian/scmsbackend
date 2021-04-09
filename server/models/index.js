"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.Users = require("./users.js")(sequelize, Sequelize);
db.Profiles = require("./profiles.js")(sequelize, Sequelize);

db.Activations = require("./activations.js")(sequelize, Sequelize);
db.Cardsdetails = require("./cardsdetails.js")(sequelize, Sequelize);
db.Dealers = require("./dealers.js")(sequelize, Sequelize);
db.Comments = require("./comments.js")(sequelize, Sequelize);

db.Users.belongsTo(db.Profiles, { as: "profiles", foreignKey: "profil_id" });
db.Profiles.hasMany(db.Users, { foreignKey: "profil_id" });

db.Activations.hasMany(db.Cardsdetails, {
  as: "cardsdetails",
  foreignKey: "act_id",
});
db.Cardsdetails.belongsTo(db.Activations, { foreignKey: "id" });

db.Activations.belongsTo(db.Dealers, {
  as: "dealers",
  foreignKey: "dealer_id",
});
db.Dealers.hasMany(db.Activations, { foreignKey: "dealer_id" });

db.Activations.belongsTo(db.Users, {
  as: "agents",
  foreignKey: "userid",
});
db.Users.hasMany(db.Activations, { foreignKey: "userid" });

db.Cardsdetails.belongsTo(db.Denominations, {
  as: "denominations",
  foreignKey: "denom_id",
});
db.Denominations.hasMany(db.Cardsdetails, { foreignKey: "denom_id" });

db.Comments.belongsTo(db.Users, { as: "agents", foreignKey: "userid" });
db.Users.hasMany(db.Comments, { foreignKey: "userid" });

module.exports = db;
