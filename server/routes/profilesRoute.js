const express = require("express");
const auth = require("../middleware/auth");
const profilesCrontroller = require("../controllers/profilesController");

const profilesRoute = express.Router();

profilesRoute.get("/profiles", auth, profilesCrontroller.list);

profilesRoute.get("/profiles/:profileId", auth, profilesCrontroller.listById);

profilesRoute.post("/profiles", auth, profilesCrontroller.create);

profilesRoute.put("/profiles/:profileId", auth, profilesCrontroller.update);

profilesRoute.put(
  "/profiles/updatestatus/:profileId",
  auth,
  profilesCrontroller.updateStatus
);

profilesRoute.delete("/profiles/:profileId", auth, profilesCrontroller.delete);

module.exports = profilesRoute;
