const express = require("express");
const authCrontroller = require("../controllers/authController");

const authRoute = express.Router();

authRoute.post("/auth", authCrontroller.auth);

authRoute.put("/auth/:userId", authCrontroller.resetPassword);

module.exports = authRoute;
