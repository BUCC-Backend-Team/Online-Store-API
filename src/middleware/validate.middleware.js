const ApiError = require('../utils/apiError');
const { middlewareResult } = require('./log.middleware');

// schema: a Joi schema. source: which part of the request to validate ('body' | 'params' | 'query')
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error } = schema.validate(req[source], { abortEarly: false });
  if (error) {
    const message = error.details.map((d) => d.message).join(', ');
    middlewareResult(req, {
      middleware: 'validate',
      result: 'rejected',
      statusCode: 400,
      reason: message,
      source,
    });
    return next(new ApiError(400, message));
  }

  middlewareResult(req, {
    middleware: 'validate',
    result: 'allowed',
    source,
  });
  next();
};
 
module.exports = validate;
 