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

const getMyOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getMyOrders({
      userId: req.user.id,
      role: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { placeOrder, getMyOrders };
