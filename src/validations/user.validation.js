const Joi = require('joi');

const signup = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateProfile = Joi.object({
  name: Joi.string().min(2).max(50),
  email: Joi.string().email(),
}).min(1); // at least one field must be provided

module.exports = { signup, login, updateProfile };