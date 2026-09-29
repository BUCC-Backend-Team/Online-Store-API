const express = require('express');
const orderController = require('./order.controller');
const validate = require('../../middleware/validate.middleware');
const { protect } = require('../../middleware/auth.middleware');
const { rateLimit } = require('../../middleware/rateLimiter.middleware');
const orderValidation = require('../../validations/order.validation');
const { moduleHit } = require('../../middleware/log.middleware');

const router = express.Router();
const hit = moduleHit('orders');

router.post('/', protect, rateLimit, validate(orderValidation.placeOrder), hit, orderController.placeOrder);
router.get('/', protect, rateLimit, hit, orderController.getOrders);
router.get('/:id', protect, rateLimit, validate(orderValidation.getOrder, 'params'), hit, orderController.getOrder);
router.post('/:id/cancel', protect, rateLimit, validate(orderValidation.cancelOrder, 'params'), hit, orderController.cancelOrder);
router.patch(
  '/:id/status',
  protect,
  rateLimit,
  validate(orderValidation.getOrder, 'params'),
  validate(orderValidation.updateStatus),
  hit,
  orderController.updateStatus
);

module.exports = router;
