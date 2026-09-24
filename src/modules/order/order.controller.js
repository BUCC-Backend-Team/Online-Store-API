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

const getOrders = async (req, res, next) => {
  try {
    const orders =
      req.user.role === 'admin'
        ? await orderService.getAllOrders({ role: req.user.role })
        : await orderService.getMyOrders({
            userId: req.user.id,
            role: req.user.role,
          });

    res.status(200).json({
      success: true,
      message: req.user.role === 'admin' ? 'All orders retrieved successfully' : 'Orders retrieved successfully',
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await orderService.getOrder({
      orderId: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { placeOrder, getOrders, getOrder };
