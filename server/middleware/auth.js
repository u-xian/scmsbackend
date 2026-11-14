require("dotenv").config();
const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  // Never let a request through when the signing key is missing.
  if (!process.env.jwtPrivateKey) {
    console.error("jwtPrivateKey is not set: refusing authenticated request");
    return res.status(500).send("Authentication is not configured.");
  }

  const token = req.header("x-auth-token");
  if (!token) return res.status(401).send("Access denied. No token provided.");

  try {
    const decoded = jwt.verify(token, process.env.jwtPrivateKey, {
      algorithms: ["HS256"],
    });
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError")
      return res.status(403).send("Token expired");
    res.status(400).send("Invalid token.");
  }
}

module.exports = auth;
