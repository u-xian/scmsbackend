const express = require("express");
const auth = require("../middleware/auth");
const carddetailsCrontroller = require("../controllers/carddetailsController");

const carddetailsRoute = express.Router();

carddetailsRoute.get("/carddetails", auth, carddetailsCrontroller.list);

carddetailsRoute.get(
  "/carddetails/:carddetailId",
  auth,
  carddetailsCrontroller.listById
);

carddetailsRoute.post("/carddetails", auth, carddetailsCrontroller.create);

carddetailsRoute.put(
  "/carddetails/:carddetailId",
  auth,
  carddetailsCrontroller.update
);

// PUT /carddetails/updatestatus/:actId and PUT /carddetails/cardactivate/:id
// were removed: they activated cards without approval. Cards are activated
// by PUT /activations/approve/:activationId at the last level.

carddetailsRoute.delete(
  "/carddetails/:carddetailId",
  auth,
  carddetailsCrontroller.delete
);

carddetailsRoute.delete(
  "/carddetails/deletebyactivId/:activId",
  auth,
  carddetailsCrontroller.deleteByActivID
);

module.exports = carddetailsRoute;
