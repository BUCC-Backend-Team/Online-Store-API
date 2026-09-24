const express = require('express');
const orderController = require('./order.controller');
const validate = require('../../middleware/validate.middleware');
const { protect } = require('../../middleware/auth.middleware');
const orderValidation = require('../../validations/order.validation');

const router = express.Router();

router.post('/', protect, validate(orderValidation.placeOrder), orderController.placeOrder);

module.exports = router;
