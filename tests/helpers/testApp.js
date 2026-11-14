/*
  Shared setup for the API tests. Runs against the test database
  (NODE_ENV=test, set by vitest), prepared once with:
    NODE_ENV=test npm run db:setup
*/
require("dotenv").config();

// Values used when .env does not provide them.
process.env.jwtPrivateKey = process.env.jwtPrivateKey || "test_only_secret";
process.env.defaultPassword = process.env.defaultPassword || "Default123";

const request = require("supertest");
const { Op } = require("sequelize");
const app = require("../../app");
const db = require("../../server/models");
const generateAuthToken = require("../../server/services/generateAuthenticationToken");
const encryptingData = require("../../server/services/dataEncrypting");
const { PROFILES } = require("../../server/middleware/requireProfile");

db.sequelize.options.logging = false;

// Every user made by the tests starts with this prefix, so they can be removed.
const TEST_PREFIX = "zztest_";

// Token of an existing user, as POST /auth would give it.
const tokenForUser = (user) =>
  generateAuthToken({
    userid: user.id,
    profileId: user.profil_id,
    username: user.username,
  });

const inDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Creates a user directly in the database. Defaults to a normal, active
// account whose password is not expired.
async function createUser(overrides = {}) {
  const { password = "Secret123", ...fields } = overrides;
  const user = await db.Users.create({
    name: "Test User",
    username: `${TEST_PREFIX}${Math.random().toString(36).slice(2, 10)}`,
    email: "test@example.com",
    profil_id: PROFILES.WAREHOUSE,
    status: true,
    first_login_flag: false,
    expired_at: inDays(30),
    password: password === null ? null : await encryptingData(password),
    ...fields,
  });
  return { user, password };
}

// Creates an active user with the given profile and returns their token.
async function tokenFor(profileId) {
  const { user } = await createUser({ profil_id: profileId });
  return tokenForUser(user);
}

async function cleanUp() {
  const testUsers = await db.Users.findAll({
    where: { username: { [Op.startsWith]: TEST_PREFIX } },
    attributes: ["id"],
  });
  const activations = await db.Activations.findAll({
    where: { userid: testUsers.map((u) => u.id) },
    attributes: ["id"],
    paranoid: false,
  });
  const actIds = activations.map((a) => a.id);
  await db.Cardsdetails.destroy({ where: { act_id: actIds }, force: true });
  await db.ActivationEvents.destroy({ where: { act_id: actIds } });
  await db.Activations.destroy({ where: { id: actIds }, force: true });

  await db.Users.destroy({
    where: { username: { [Op.startsWith]: TEST_PREFIX } },
  });
  await db.Cardsdetails.destroy({
    where: { batch: { [Op.startsWith]: TEST_PREFIX } },
    force: true,
  });
}

module.exports = {
  api: () => request(app),
  db,
  PROFILES,
  TEST_PREFIX,
  tokenFor,
  tokenForUser,
  createUser,
  cleanUp,
};
