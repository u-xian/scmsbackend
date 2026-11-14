// Profile ids, as created by server/seeders/profilesData.json
const PROFILES = Object.freeze({
  ADMIN: 1,
  WAREHOUSE: 2,
  ACCOUNTING: 3,
  BILLING: 4,
});

// Use after the auth middleware: lets the request through only when the
// logged-in user has one of the given profiles.
const requireProfile =
  (...allowedProfileIds) =>
  (req, res, next) => {
    if (!req.user || !allowedProfileIds.includes(Number(req.user.profileId)))
      return res.status(403).send("Access denied. Not allowed for your profile.");
    next();
  };

module.exports = { PROFILES, requireProfile };
