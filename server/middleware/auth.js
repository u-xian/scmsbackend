require("dotenv").config();
const jwt = require("jsonwebtoken");
const { Users } = require("../models");

const unauthorized = (res, message) => res.status(401).send(message);

async function auth(req, res, next) {
  // Never let a request through when the signing key is missing.
  if (!process.env.jwtPrivateKey) {
    console.error("jwtPrivateKey is not set: refusing authenticated request");
    return res.status(500).send("Authentication is not configured.");
  }

  const token = req.header("x-auth-token");
  if (!token) return unauthorized(res, "Access denied. No token provided.");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.jwtPrivateKey, {
      algorithms: ["HS256"],
    });
  } catch (error) {
    if (error.name === "TokenExpiredError")
      return res.status(403).send("Token expired");
    return res.status(400).send("Invalid token.");
  }

  // The token is valid for an hour, but the account may have changed since
  // it was issued. Check it on every request, so that disabling or deleting
  // a user, or changing their profile, takes effect immediately.
  try {
    const userId = Number(decoded.userid);
    const user = Number.isInteger(userId)
      ? await Users.findByPk(userId, {
          attributes: ["id", "username", "status", "profil_id"],
        })
      : null;

    if (!user || user.status !== true)
      return unauthorized(res, "Access denied. Account disabled or removed.");

    req.user = {
      ...decoded,
      userid: user.id,
      username: user.username,
      profileId: user.profil_id,
    };
  } catch (error) {
    return next(error);
  }
  next();
}

module.exports = auth;
