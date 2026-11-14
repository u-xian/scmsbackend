/*
  Last middleware of the app. Turns errors into HTTP answers instead of
  letting them stop the server. Details are logged, never sent to the client.
*/

// PostgreSQL "data exception" errors (class 22), e.g. 22P02 when "abc" is
// given where an integer id is expected. They are caused by bad input.
const isBadInputDatabaseError = (err) =>
  err.name === "SequelizeDatabaseError" &&
  typeof err.parent?.code === "string" &&
  err.parent.code.startsWith("22");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Errors that already carry a client status, e.g. malformed JSON body.
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500)
    return res.status(status).send(err.expose ? err.message : "Bad request");

  if (err.name === "SequelizeUniqueConstraintError")
    return res.status(409).send("Record already exists");

  if (err.name === "SequelizeValidationError" || isBadInputDatabaseError(err))
    return res.status(400).send("Invalid input");

  console.error(err);
  res.status(500).send("Internal server error");
}

module.exports = errorHandler;
