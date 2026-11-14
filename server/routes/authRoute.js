const express = require("express");
const authCrontroller = require("../controllers/authController");

const authRoute = express.Router();

authRoute.post("/auth", authCrontroller.auth);

// No token: users on their first login or with an expired password have none.
// The current password is checked instead.
authRoute.put("/auth/:userId", authCrontroller.resetPassword);

module.exports = authRoute;
