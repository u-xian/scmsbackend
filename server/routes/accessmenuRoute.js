const express = require("express");
const auth = require("../middleware/auth");
const accessmenuCrontroller = require("../controllers/accessmenusController");

const accessmenuRoute = express.Router();

accessmenuRoute.get("/accessmenu", auth, accessmenuCrontroller.list);

accessmenuRoute.get(
  "/accessmenu/:accessmenuId",
  auth,
  accessmenuCrontroller.listById
);

accessmenuRoute.get(
  "/accessmenu/listmenu/:profilelevelId",
  auth,
  accessmenuCrontroller.listMenu
);

accessmenuRoute.get(
  "/accessmenu/listdefaultmenu/:profilelevelId",
  auth,
  accessmenuCrontroller.listDefaultMenu
);

accessmenuRoute.post("/accessmenu", auth, accessmenuCrontroller.create);

accessmenuRoute.put(
  "/accessmenu/:accessmenuId",
  auth,
  accessmenuCrontroller.update
);

accessmenuRoute.put(
  "/accessmenu/updatestatus/:accessmenuId",
  auth,
  accessmenuCrontroller.updateStatus
);

accessmenuRoute.delete(
  "/accessmenu/:accessmenuId",
  auth,
  accessmenuCrontroller.delete
);

module.exports = accessmenuRoute;
