require("dotenv").config();
const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  if (!process.env.jwtPrivateKey) return next();

  const token = req.header("x-auth-token");
  if (!token) return res.status(401).send("Access denied. No token provided.");

  try {
    const decoded = jwt.verify(token, process.env.jwtPrivateKey);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError")
      return res.status(403).send("Token expired");
    res.status(400).send("Invalid token.");
  }
}

module.exports = auth;
