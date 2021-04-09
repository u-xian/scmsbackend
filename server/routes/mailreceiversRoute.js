const express = require("express");
const auth = require("../middleware/auth");
const mailreceiversCrontroller = require("../controllers/mailreceiversController");

const mailreceiversRoute = express.Router();

mailreceiversRoute.get("/mailreceivers", auth, mailreceiversCrontroller.list);

mailreceiversRoute.get(
  "/mailreceivers/:mailreceiverId",
  auth,
  mailreceiversCrontroller.listById
);

mailreceiversRoute.post(
  "/mailreceivers",
  auth,
  mailreceiversCrontroller.create
);

mailreceiversRoute.put(
  "/mailreceivers/:mailreceiverId",
  auth,
  mailreceiversCrontroller.update
);

mailreceiversRoute.put(
  "/mailreceivers/updatestatus/:mailreceiverId",
  auth,
  mailreceiversCrontroller.updateStatus
);

mailreceiversRoute.delete(
  "/mailreceivers/:mailreceiverId",
  auth,
  mailreceiversCrontroller.delete
);

module.exports = mailreceiversRoute;
