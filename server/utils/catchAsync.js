/*
  Express 4 ignores the promise returned by an async handler, so a rejected
  promise (for example a database error) is never passed to the error
  handler and Node stops the process. catchAsync wraps every handler of a
  controller so that errors are forwarded to next() instead.
*/
const catchAsync = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const catchAsyncController = (controller) =>
  Object.fromEntries(
    Object.entries(controller).map(([name, handler]) => [
      name,
      typeof handler === "function" ? catchAsync(handler) : handler,
    ]),
  );

module.exports = { catchAsync, catchAsyncController };
