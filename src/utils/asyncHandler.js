/**
  * Wrapper to eliminate repetitive try-catch blocks in route handlers / controllers.
  * Forwards any caught error to the next() express error handling middleware.
  */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
