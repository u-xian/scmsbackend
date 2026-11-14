const express = require("express");
const auth = require("../middleware/auth");
const { PROFILES, requireProfile } = require("../middleware/requireProfile");

const usersCrontroller = require("../controllers/usersController");

const usersRoute = express.Router();

usersRoute.get("/user", auth, usersCrontroller.list);

usersRoute.get("/user/:userId", auth, usersCrontroller.listById);

// Only an admin can create users. The first admin of a new database is
// created with: npm run create-admin -- <username> "<name>" <email>
usersRoute.post(
  "/user",
  auth,
  requireProfile(PROFILES.ADMIN),
  usersCrontroller.create,
);

usersRoute.put("/user/:userId", auth, usersCrontroller.update);

usersRoute.put("/user/updatestatus/:userId", auth, usersCrontroller.updateStatus);

usersRoute.delete("/user/:userId", auth, usersCrontroller.delete);

module.exports = usersRoute;
