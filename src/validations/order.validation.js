const Joi = require('joi');

// Client sends product ids and quantities. Price is taken from the product row
// at placement time so a customer cannot set their own unit price.
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
