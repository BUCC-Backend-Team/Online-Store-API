const express = require('express');
const productController = require('./product.controller');
const validate = require('../../middleware/validate.middleware');
const { protect } = require('../../middleware/auth.middleware');
const productValidation = require('../../validations/product.validation');
const { moduleHit } = require('../../middleware/log.middleware');

const router = express.Router();
const hit = moduleHit('products');

router.post('/', protect, validate(productValidation.createProduct), hit, productController.createProduct);
router.get('/', protect, validate(productValidation.listProducts, 'query'), hit, productController.getProducts);
router.get('/:sku', protect, validate(productValidation.getProduct, 'params'), hit, productController.getProduct);
router.patch(
  '/:sku',
  protect,
  validate(productValidation.getProduct, 'params'),
  validate(productValidation.updateProduct),
  hit,
  productController.updateProduct
);
router.post(
  '/:sku/deactivate',
  protect,
  validate(productValidation.getProduct, 'params'),
  hit,
  productController.deactivateProduct
);

module.exports = router;
