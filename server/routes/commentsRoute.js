const express = require("express");
const auth = require("../middleware/auth");
const commentsCrontroller = require("../controllers/commentsController");

const commentsRoute = express.Router();

commentsRoute.get("/comments", auth, commentsCrontroller.list);

commentsRoute.get("/comments/:commentId", auth, commentsCrontroller.listById);

commentsRoute.post("/comments", auth, commentsCrontroller.create);

commentsRoute.put("/comments/:commentId", auth, commentsCrontroller.update);

commentsRoute.delete("/comments/:commentId", auth, commentsCrontroller.delete);

module.exports = commentsRoute;
