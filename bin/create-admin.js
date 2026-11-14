/*
  Creates an admin user. Needed once on a new database, because
  POST /api/v1/user is reserved to admins.

  Usage: npm run create-admin -- <username> "<full name>" <email>

  The password is the defaultPassword from .env. It must be changed at the
  first login.
*/
require("dotenv").config();

const { Users, sequelize } = require("../server/models");
const { PROFILES } = require("../server/middleware/requireProfile");
const encryptingData = require("../server/services/dataEncrypting");

async function main() {
  const [username, name, email] = process.argv.slice(2);
  if (!username || !name || !email) {
    console.error(
      'Usage: npm run create-admin -- <username> "<full name>" <email>',
    );
    return 1;
  }
  if (username.length < 5) {
    console.error("The username needs at least 5 characters (login rule).");
    return 1;
  }
  if (!process.env.defaultPassword) {
    console.error("defaultPassword is not set in .env");
    return 1;
  }
  if (await Users.findOne({ where: { username } })) {
    console.error(`User "${username}" already exists.`);
    return 1;
  }

  const expiringDate = new Date();
  expiringDate.setDate(expiringDate.getDate() + 30);

  await Users.create({
    name,
    username,
    email,
    profil_id: PROFILES.ADMIN,
    password: await encryptingData(process.env.defaultPassword),
    status: true,
    first_login_flag: true,
    expired_at: expiringDate,
  });
  console.log(
    `Admin "${username}" created. Log in with the defaultPassword, then change it.`,
  );
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
