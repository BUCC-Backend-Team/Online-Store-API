const orderService = require('./order.service');

const placeOrder = async (req, res, next) => {
  try {
    const order = await orderService.placeOrder({
      userId: req.user.id,
      role: req.user.role,
      items: req.body.items,
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { placeOrder };
