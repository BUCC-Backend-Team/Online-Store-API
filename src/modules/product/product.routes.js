const express = require('express');
const productController = require('./product.controller');
const validate = require('../../middleware/validate.middleware');
const { protect } = require('../../middleware/auth.middleware');
const productValidation = require('../../validations/product.validation');

const router = express.Router();

router.post('/', protect, validate(productValidation.createProduct), productController.createProduct);
router.get('/', protect, validate(productValidation.listProducts, 'query'), productController.getProducts);
router.get('/:sku', protect, validate(productValidation.getProduct, 'params'), productController.getProduct);
router.patch(
  '/:sku',
  protect,
  validate(productValidation.getProduct, 'params'),
  validate(productValidation.updateProduct),
  productController.updateProduct
);
router.post(
  '/:sku/deactivate',
  protect,
  validate(productValidation.getProduct, 'params'),
  productController.deactivateProduct
);

module.exports = router;
