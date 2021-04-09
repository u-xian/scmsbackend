const express = require("express");
const logger = require("morgan");
const cors = require("cors");
const indexRouter = require("./server/routes");

// Set up the express app
const app = express();

//require("./server/config/prod")(app);

app.use(cors());

// Log requests to the console.
app.use(logger("dev"));

app.use("/", indexRouter);

module.exports = app;
