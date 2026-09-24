const logger = require('../utils/logger');

const moduleHit = (moduleName) => (req, res, next) => {
  logger.info('module hit', {
    event: 'module.hit',
    module: moduleName,
    method: req.method,
    path: req.originalUrl,
  });
  next();
};

const middlewareResult = (req, { middleware, result, statusCode, reason, source }) => {
  logger.info('middleware result', {
    event: 'middleware.result',
    middleware,
    result,
    statusCode,
    reason,
    source,
    method: req.method,
    path: req.originalUrl,
  });
};

module.exports = { moduleHit, middlewareResult };
