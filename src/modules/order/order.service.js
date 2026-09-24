const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');

const MAX_ATTEMPTS = 3;

const toCents = (value) => {
  const match = String(value).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new ApiError(500, 'Stored product price is invalid');
  }

  const fraction = (match[2] || '').padEnd(2, '0');
  return Number(match[1]) * 100 + Number(fraction);
};

const formatCents = (cents) => {
  const whole = Math.trunc(cents / 100);
  const fraction = String(Math.abs(cents % 100)).padStart(2, '0');
  return `${whole}.${fraction}`;
};

const serializeOrder = (order) => ({
  id: order.id,
  userId: order.userId,
  status: order.status,
  totalAmount: formatCents(toCents(order.totalAmount)),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  items: order.items.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: formatCents(toCents(item.unitPrice)),
  })),
});

// Locks products in a stable order so two customers buying overlapping
// products wait on each other instead of both reading the same stock.
const lockProducts = async (tx, items) => {
  const lockedById = new Map();

  for (const item of items) {
    const rows = await tx.$queryRaw`
      SELECT product_id, sku, name, price, stock_quantity, is_active
      FROM products
      WHERE product_id = CAST(${item.productId} AS uuid)
      FOR UPDATE
    `;

    if (rows.length > 0) {
      lockedById.set(String(rows[0].product_id).toLowerCase(), rows[0]);
    }
  }

  return lockedById;
};

const createOrderTransaction = async (userId, items) => {
  const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(401, 'User belonging to this token no longer exists.');
    }
    if (user.isActive === false) {
      throw new ApiError(403, 'Inactive accounts cannot place orders');
    }

    const lockedById = await lockProducts(tx, sortedItems);

    const missing = [];
    const conflicts = [];
    const lines = [];

    for (const item of sortedItems) {
      const product = lockedById.get(item.productId.toLowerCase());
      if (!product) {
        missing.push(item.productId);
        continue;
      }

      if (product.is_active === false) {
        conflicts.push(`${product.name} is not available`);
        continue;
      }

      const available = Number(product.stock_quantity);
      if (!Number.isInteger(available) || available < item.quantity) {
        const onHand = Number.isInteger(available) ? available : 0;
        conflicts.push(
          `Insufficient stock for ${product.name}. Requested ${item.quantity}, available ${onHand}`
        );
        continue;
      }

      const unitCents = toCents(product.price);
      lines.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: formatCents(unitCents),
        lineCents: unitCents * item.quantity,
      });
    }

    // Throw before any write so the transaction rolls back with nothing saved.
    if (missing.length > 0 || conflicts.length > 0) {
      const details = [
        ...missing.map((id) => `Product ${id} was not found`),
        ...conflicts,
      ];
      const statusCode = conflicts.length === 0 ? 404 : 409;
      throw new ApiError(statusCode, details.join('; '));
    }

    for (const line of lines) {
      const updated = await tx.product.updateMany({
        where: {
          id: line.productId,
          stockQuantity: { gte: line.quantity },
        },
        data: {
          stockQuantity: { decrement: line.quantity },
        },
      });

      if (updated.count !== 1) {
        throw new ApiError(409, 'Stock changed while placing the order. Please try again.');
      }
    }

    const totalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);

    const order = await tx.order.create({
      data: {
        userId,
        status: 'pending',
        totalAmount: formatCents(totalCents),
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    return serializeOrder(order);
  });
};

const getMyOrders = async ({ userId, role }) => {
  if (role !== 'customer') {
    throw new ApiError(403, 'Only customers can view their orders');
  }

  const orders = await prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map(serializeOrder);
};

const getOrder = async ({ orderId, userId, role }) => {
  if (role !== 'customer' && role !== 'admin') {
    throw new ApiError(403, 'Only customers and admins can view an order');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  if (role === 'customer' && order.userId.toLowerCase() !== userId.toLowerCase()) {
    throw new ApiError(403, 'You can only view your own orders');
  }

  return serializeOrder(order);
};

const CANCELLABLE_STATUSES = new Set(['pending', 'paid']);

const cancelOrderTransaction = async ({ orderId, userId, role }) => {
  return prisma.$transaction(async (tx) => {
    const lockedOrders = await tx.$queryRaw`
      SELECT order_id, user_id, status
      FROM orders
      WHERE order_id = CAST(${orderId} AS uuid)
      FOR UPDATE
    `;

    if (lockedOrders.length === 0) {
      throw new ApiError(404, 'Order not found');
    }

    const orderRow = lockedOrders[0];
    if (role === 'customer' && String(orderRow.user_id).toLowerCase() !== userId.toLowerCase()) {
      throw new ApiError(403, 'You can only cancel your own orders');
    }

    if (!CANCELLABLE_STATUSES.has(orderRow.status)) {
      const message =
        orderRow.status === 'cancelled'
          ? 'Order is already cancelled'
          : 'Shipped orders cannot be cancelled';
      throw new ApiError(409, message);
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    const sortedItems = [...order.items].sort((a, b) => a.productId.localeCompare(b.productId));
    const lockedProducts = await lockProducts(tx, sortedItems);

    for (const item of sortedItems) {
      if (!lockedProducts.has(item.productId.toLowerCase())) {
        throw new ApiError(409, 'A product on this order no longer exists');
      }

      const restored = await tx.product.updateMany({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });

      if (restored.count !== 1) {
        throw new ApiError(409, 'Could not restore stock for this order');
      }
    }

    const cancelled = await tx.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
      include: { items: true },
    });

    return serializeOrder(cancelled);
  });
};

const cancelOrder = async ({ orderId, userId, role }) => {
  if (role !== 'customer' && role !== 'admin') {
    throw new ApiError(403, 'Only customers and admins can cancel an order');
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await cancelOrderTransaction({ orderId, userId, role });
    } catch (error) {
      const retryable = error.code === 'P2034' && attempt < MAX_ATTEMPTS;
      if (!retryable) {
        throw error;
      }
    }
  }
};

const REQUIRED_CURRENT_STATUS = {
  paid: 'pending',
  shipped: 'paid',
};

const updateOrderStatus = async ({ orderId, status, role }) => {
  if (role !== 'admin') {
    throw new ApiError(403, 'Only admins can update order status');
  }

  const updated = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: REQUIRED_CURRENT_STATUS[status],
    },
    data: { status },
  });

  if (updated.count === 1) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return serializeOrder(order);
  }

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new ApiError(404, 'Order not found');
  }

  throw new ApiError(409, `Order cannot move from ${existing.status} to ${status}`);
};

const getAllOrders = async ({ role }) => {
  if (role !== 'admin') {
    throw new ApiError(403, 'Only admins can view all orders');
  }

  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map(serializeOrder);
};

const placeOrder = async ({ userId, role, items }) => {
  if (role !== 'customer') {
    throw new ApiError(403, 'Only customers can place orders');
  }

  const normalizedItems = items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity),
  }));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await createOrderTransaction(userId, normalizedItems);
    } catch (error) {
      // P2034: write conflict or deadlock. The other customer's transaction
      // won the stock lock; retry against the committed stock.
      const retryable = error.code === 'P2034' && attempt < MAX_ATTEMPTS;
      if (!retryable) {
        throw error;
      }
    }
  }
};

module.exports = { placeOrder, getMyOrders, getAllOrders, getOrder, cancelOrder, updateOrderStatus };
