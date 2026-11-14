const express = require("express");
const auth = require("../middleware/auth");
const authCrontroller = require("../controllers/authController");

const authRoute = express.Router();

authRoute.post("/auth", authCrontroller.auth);

authRoute.put("/auth/:userId", auth, authCrontroller.resetPassword);

module.exports = authRoute;
