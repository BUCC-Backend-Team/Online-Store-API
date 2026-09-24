const ApiError = require('../utils/apiError');
 
// schema: a Joi schema. source: which part of the request to validate ('body' | 'params' | 'query')
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error } = schema.validate(req[source], { abortEarly: false });
  if (error) {
    const message = error.details.map((d) => d.message).join(', ');
    return next(new ApiError(400, message));
  }
  next();
};
 
module.exports = validate;
 