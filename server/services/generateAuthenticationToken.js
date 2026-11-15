require("dotenv").config();
const jwt = require("njwt");

//3600000 milliseconds correponds to 3600 sec to 1 hr
const generateAuthToken = (payload) => {
  const token = jwt.create(payload, process.env.jwtPrivateKey);
  token.setExpiration(new Date().getTime() + 3600000);
  return token.compact();
};

module.exports = generateAuthToken;
