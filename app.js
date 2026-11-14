const express = require("express");
const logger = require("morgan");
const cors = require("cors");
const indexRouter = require("./server/routes");
const errorHandler = require("./server/middleware/errorHandler");

// Set up the express app
const app = express();

//require("./server/config/prod")(app);

app.use(cors());

// Log requests to the console.
app.use(logger("dev"));

app.use("/", indexRouter);

// Must stay after the routes
app.use(errorHandler);

module.exports = app;
