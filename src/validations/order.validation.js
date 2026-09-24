const Joi = require('joi');

const placeOrder = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .unique((a, b) => a.productId === b.productId)
    .required()
    .messages({
      'array.min': 'Order must include at least one item',
      'array.unique': 'Each product can only appear once in an order',
    }),
});

module.exports = { placeOrder };
