const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

// Converts non-ApiError errors (unexpected bugs, Prisma errors, etc.) into a safe ApiError
const errorConverter = (err, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false);
  }
  next(error);
};

// Final handler — logs and responds
const errorHandler = (err, req, res, next) => {
  const { statusCode = 500, message } = err;

  logger.error(message, {
    requestId: req.id,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.id,
  });
};

module.exports = { errorConverter, errorHandler };