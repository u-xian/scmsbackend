const express = require("express");
const auth = require("../middleware/auth");
const denominationCrontroller = require("../controllers/denominationController");

const denominationRoute = express.Router();

denominationRoute.get("/denomination", auth, denominationCrontroller.list);

denominationRoute.get(
  "/denomination/:denominationId",
  auth,
  denominationCrontroller.listById
);

denominationRoute.post("/denomination", auth, denominationCrontroller.create);

denominationRoute.put(
  "/denomination/:denominationId",
  auth,
  denominationCrontroller.update
);

denominationRoute.put(
  "/denomination/updatestatus/:denominationId",
  auth,
  denominationCrontroller.updateStatus
);

denominationRoute.delete(
  "/denomination/:denominationId",
  auth,
  denominationCrontroller.delete
);

module.exports = denominationRoute;
