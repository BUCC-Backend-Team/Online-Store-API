const Joi = require('joi');

const price = Joi.alternatives()
  .try(Joi.number().positive(), Joi.string().pattern(/^\d+(\.\d{1,2})?$/))
  .required()
  .messages({
    'alternatives.match': 'Price must be a positive amount with at most 2 decimal places',
  });

const createProduct = Joi.object({
  sku: Joi.string().trim().min(1).max(100).required(),
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().allow('', null),
  price,
  stockQuantity: Joi.number().integer().min(0).required(),
  isActive: Joi.boolean(),
});

module.exports = { createProduct };
