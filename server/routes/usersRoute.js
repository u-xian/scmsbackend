const express = require("express");
const auth = require("../middleware/auth");

const usersCrontroller = require("../controllers/usersController");

const usersRoute = express.Router();

usersRoute.get("/user", auth, usersCrontroller.list);

usersRoute.get("/user/:userId", auth, usersCrontroller.listById);

usersRoute.post("/user", usersCrontroller.create);

usersRoute.put("/user/:userId", auth, usersCrontroller.update);

usersRoute.put("/user/updatestatus/:userId", auth, usersCrontroller.updateStatus);

usersRoute.delete("/user/:userId", auth, usersCrontroller.delete);

module.exports = usersRoute;
