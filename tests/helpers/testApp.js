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

// Every record made by the tests (usernames, dealer names, labels, ...)
// starts with this prefix, so it can be removed afterwards.
const TEST_PREFIX = "zztest_";

// Token of an existing user, as POST /auth would give it.
const tokenForUser = (user) =>
  generateAuthToken({
    userid: user.id,
    profileId: user.profil_id,
    username: user.username,
    tv: user.token_version ?? 0,
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

// Creates an active user with the given profile; returns the user, their
// token and request helpers that send the token, e.g. admin.get("/dealers").
async function loginAs(profileId, fields = {}) {
  const { user, password } = await createUser({ profil_id: profileId, ...fields });
  const token = tokenForUser(user);
  const call = (method) => (path) =>
    request(app)[method](`/api/v1${path}`).set("x-auth-token", token);
  return {
    user,
    password,
    token,
    get: call("get"),
    post: call("post"),
    put: call("put"),
    delete: call("delete"),
  };
}

// Unique name with the test prefix.
const uniqueName = (label = "") =>
  `${TEST_PREFIX}${label}${Math.random().toString(36).slice(2, 8)}`;

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

  const prefixed = (field) => ({ [field]: { [Op.startsWith]: TEST_PREFIX } });
  await db.Comments.destroy({
    where: {
      [Op.or]: [
        prefixed("comment_text"),
        { userid: testUsers.map((u) => u.id) },
      ],
    },
  });
  await db.Dealers.destroy({ where: prefixed("dealername") });
  await db.Denominations.destroy({ where: prefixed("label") });
  await db.Mailreceivers.destroy({ where: prefixed("names") });
  await db.Profiles.destroy({ where: prefixed("profilename") });
  await db.AccessMenu.destroy({ where: prefixed("pathname") });
}

module.exports = {
  api: () => request(app),
  db,
  PROFILES,
  TEST_PREFIX,
  tokenFor,
  tokenForUser,
  createUser,
  loginAs,
  uniqueName,
  cleanUp,
};
