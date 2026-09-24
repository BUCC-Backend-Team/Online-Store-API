const Joi = require('joi');

const price = Joi.alternatives()
  .try(Joi.number().positive(), Joi.string().pattern(/^\d+(\.\d{1,2})?$/))
  .messages({
    'alternatives.match': 'Price must be a positive amount with at most 2 decimal places',
  });

const createProduct = Joi.object({
  sku: Joi.string().trim().min(1).max(100).required(),
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().allow('', null),
  price: price.required(),
  stockQuantity: Joi.number().integer().min(0).required(),
  isActive: Joi.boolean(),
});

const updateProduct = Joi.object({
  sku: Joi.string().trim().min(1).max(100),
  name: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().allow('', null),
  price,
  stockQuantity: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
}).min(1);

const listProducts = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const getProduct = Joi.object({
  sku: Joi.string().trim().min(1).max(100).required(),
});

module.exports = { createProduct, listProducts, getProduct, updateProduct };
