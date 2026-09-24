const productService = require('./product.service');

const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct({
      role: req.user.role,
      sku: req.body.sku,
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      stockQuantity: req.body.stockQuantity,
      isActive: req.body.isActive,
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createProduct };
