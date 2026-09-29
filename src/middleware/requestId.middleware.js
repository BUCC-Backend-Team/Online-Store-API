const crypto = require('crypto');
const logger = require('../utils/logger');
const { runWithRequest } = require('../utils/requestContext');

const requestId = (req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);

  runWithRequest({ requestId: req.id }, () => {
    logger.info('request received', {
      event: 'request.received',
      method: req.method,
      path: req.originalUrl,
    });
    next();
  });
};

module.exports = requestId;