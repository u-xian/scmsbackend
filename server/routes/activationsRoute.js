const express = require("express");
const auth = require("../middleware/auth");
const activationsCrontroller = require("../controllers/activationsController");

const activationsRoute = express.Router();

activationsRoute.get(
  "/activations/activbyprofile/:profileId",
  auth,
  activationsCrontroller.list
);

activationsRoute.get(
  "/activations/:activationId",
  auth,
  activationsCrontroller.listById
);

activationsRoute.post("/activations", auth, activationsCrontroller.create);

activationsRoute.put(
  "/activations/:activationId",
  auth,
  activationsCrontroller.update
);

activationsRoute.put(
  "/activations/confirm/:activationId",
  auth,
  activationsCrontroller.updateConfirmation
);

activationsRoute.put(
  "/activations/updatestatus/:activationId",
  auth,
  activationsCrontroller.updateStatus
);

activationsRoute.delete(
  "/activations/:activationId",
  auth,
  activationsCrontroller.delete
);

module.exports = activationsRoute;
