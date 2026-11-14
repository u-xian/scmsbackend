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

// Approval workflow (rules in server/services/activationWorkflow.js).
// They replace PUT /activations/confirm/:activationId and
// PUT /activations/updatestatus/:activationId, which skipped the rules.
activationsRoute.put(
  "/activations/approve/:activationId",
  auth,
  activationsCrontroller.approve
);

activationsRoute.put(
  "/activations/reject/:activationId",
  auth,
  activationsCrontroller.reject
);

activationsRoute.put(
  "/activations/resubmit/:activationId",
  auth,
  activationsCrontroller.resubmit
);

activationsRoute.delete(
  "/activations/:activationId",
  auth,
  activationsCrontroller.delete
);

module.exports = activationsRoute;
