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

const getProducts = async (req, res, next) => {
  try {
    const result = await productService.getProducts({
      role: req.user.role,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });

    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const product = await productService.getProductBySku({
      role: req.user.role,
      sku: req.params.sku,
    });

    res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct({
      role: req.user.role,
      sku: req.params.sku,
      updates: req.body,
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createProduct, getProducts, getProduct, updateProduct };
