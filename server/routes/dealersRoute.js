const express = require("express");
const auth = require("../middleware/auth");
const dealersCrontroller = require("../controllers/dealersController");

const dealersRoute = express.Router();

dealersRoute.get("/dealers", auth, dealersCrontroller.list);

dealersRoute.get("/dealers/:dealerId", auth, dealersCrontroller.listById);

dealersRoute.post("/dealers", auth, dealersCrontroller.create);

dealersRoute.put("/dealers/:dealerId", auth, dealersCrontroller.update);

dealersRoute.put(
  "/dealers/updatestatus/:dealerId",
  auth,
  dealersCrontroller.updateStatus
);

dealersRoute.delete("/dealers/:dealerId", auth, dealersCrontroller.delete);

module.exports = dealersRoute;
