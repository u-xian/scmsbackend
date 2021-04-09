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

carddetailsRoute.put(
  "/carddetails/updatestatus/:actId",
  auth,
  carddetailsCrontroller.updateStatusByActiv
);

carddetailsRoute.put(
  "/carddetails/cardactivate/:carddetailId",
  auth,
  carddetailsCrontroller.updateCarddetailsStatus
);

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
