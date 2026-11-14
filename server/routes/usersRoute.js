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

// Admins can edit anyone. Other users can edit their own details but not
// their profile (checked in the controller).
usersRoute.put("/user/:userId", auth, usersCrontroller.update);

usersRoute.put(
  "/user/updatestatus/:userId",
  auth,
  requireProfile(PROFILES.ADMIN),
  usersCrontroller.updateStatus,
);

usersRoute.delete(
  "/user/:userId",
  auth,
  requireProfile(PROFILES.ADMIN),
  usersCrontroller.delete,
);

module.exports = usersRoute;
