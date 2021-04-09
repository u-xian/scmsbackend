const express = require("express");
const logger = require("morgan");
const bodyParser = require("body-parser");

// Include Routes
const authRoute = require("./authRoute");
const usersRoute = require("./usersRoute");
const activationsRoute = require("./activationsRoute");
const carddetailsRoute = require("./carddetailsRoute");
const dealersRoute = require("./dealersRoute");
const denominationRoute = require("./denominationRoute");
const mailreceiversRoute = require("./mailreceiversRoute");
const profilesRoute = require("./profilesRoute");
const accessmenuRoute = require("./accessmenuRoute");
const commentsRoute = require("./commentsRoute");

// Set up the express app
const app = express();

// Log requests to the console.
app.use(logger("dev"));

// Parse incoming requests data
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup a default catch-all route that sends back a welcome message in JSON format.

app.get("/api/v1/", (req, res) =>
  res.status(200).send({
    message: "Welcome to the SCMS Backend API",
  })
);
//Authentication
app.use("/api/v1/", authRoute);
app.use("/api/v1/", usersRoute);

//Features routes
app.use("/api/v1/", activationsRoute);
app.use("/api/v1/", carddetailsRoute);
app.use("/api/v1/", dealersRoute);
app.use("/api/v1/", denominationRoute);
app.use("/api/v1/", mailreceiversRoute);
app.use("/api/v1/", profilesRoute);
app.use("/api/v1/", accessmenuRoute);
app.use("/api/v1/", commentsRoute);

module.exports = app;
