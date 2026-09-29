const { randomUUID } = require('crypto');

jest.mock('../../src/config/prisma', () => ({
  user: { findUnique: jest.fn() },
  product: { updateMany: jest.fn() },
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
}));

const prisma = require('../../src/config/prisma');
const orderService = require('../../src/modules/order/order.service');
const { makeUser, makeOrder, makeOrderItem, makeProductRow, makeOrderRow } = require('../helpers/factories');

// Makes $transaction call the callback with the same mock prisma (acts as tx)
const useTx = () => prisma.$transaction.mockImplementation((fn) => fn(prisma));

describe('orderService', () => {
  describe('placeOrder', () => {
    it('customer places order: stock decremented, order created', async () => {
      const userId = randomUUID();
      const productId = randomUUID();
      const user = makeUser({ id: userId });
      const productRow = makeProductRow({ product_id: productId, price: '9.99', stock_quantity: 10 });
      const createdOrder = makeOrder({
        userId,
        totalAmount: '9.99',
        orderItems: [makeOrderItem({ productId, quantity: 1, unitPrice: '9.99' })],
      });

      useTx();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.$queryRaw.mockResolvedValue([productRow]);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.create.mockResolvedValue(createdOrder);

      const result = await orderService.placeOrder({
        userId,
        role: 'customer',
        items: [{ productId, quantity: 1 }],
      });

      expect(result.id).toBe(createdOrder.id);
      expect(result.status).toBe('pending');
      expect(prisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stockQuantity: { decrement: 1 } } })
      );
    });

    it('throws 403 if caller is admin', async () => {
      await expect(
        orderService.placeOrder({ userId: randomUUID(), role: 'admin', items: [] })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 404 if product not found', async () => {
      const userId = randomUUID();
      useTx();
      prisma.user.findUnique.mockResolvedValue(makeUser({ id: userId }));
      prisma.$queryRaw.mockResolvedValue([]); // no product row

      await expect(
        orderService.placeOrder({ userId, role: 'customer', items: [{ productId: randomUUID(), quantity: 1 }] })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 if insufficient stock', async () => {
      const userId = randomUUID();
      const productId = randomUUID();
      useTx();
      prisma.user.findUnique.mockResolvedValue(makeUser({ id: userId }));
      prisma.$queryRaw.mockResolvedValue([
        makeProductRow({ product_id: productId, stock_quantity: 2 }), // only 2 in stock
      ]);

      await expect(
        orderService.placeOrder({ userId, role: 'customer', items: [{ productId, quantity: 5 }] })
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('throws 409 if product is inactive', async () => {
      const userId = randomUUID();
      const productId = randomUUID();
      useTx();
      prisma.user.findUnique.mockResolvedValue(makeUser({ id: userId }));
      prisma.$queryRaw.mockResolvedValue([
        makeProductRow({ product_id: productId, is_active: false }),
      ]);

      await expect(
        orderService.placeOrder({ userId, role: 'customer', items: [{ productId, quantity: 1 }] })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 401 if user no longer exists', async () => {
      useTx();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        orderService.placeOrder({ userId: randomUUID(), role: 'customer', items: [{ productId: randomUUID(), quantity: 1 }] })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 403 if user account is inactive', async () => {
      useTx();
      prisma.user.findUnique.mockResolvedValue(makeUser({ isActive: false }));

      await expect(
        orderService.placeOrder({ userId: randomUUID(), role: 'customer', items: [{ productId: randomUUID(), quantity: 1 }] })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getMyOrders', () => {
    it('customer gets own orders', async () => {
      const userId = randomUUID();
      const orders = [makeOrder({ userId }), makeOrder({ userId })];
      prisma.order.findMany.mockResolvedValue(orders);

      const result = await orderService.getMyOrders({ userId, role: 'customer' });

      expect(result).toHaveLength(2);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } })
      );
    });

    it('throws 403 if caller is admin', async () => {
      await expect(
        orderService.getMyOrders({ userId: randomUUID(), role: 'admin' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getOrder', () => {
    it('customer retrieves own order', async () => {
      const userId = randomUUID();
      const order = makeOrder({ userId });
      prisma.order.findUnique.mockResolvedValue(order);

      const result = await orderService.getOrder({ orderId: order.id, userId, role: 'customer' });

      expect(result.id).toBe(order.id);
    });

    it('throws 403 if customer tries to get another user order', async () => {
      const order = makeOrder({ userId: randomUUID() }); // different user
      prisma.order.findUnique.mockResolvedValue(order);

      await expect(
        orderService.getOrder({ orderId: order.id, userId: randomUUID(), role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('admin can retrieve any order', async () => {
      const order = makeOrder({ userId: randomUUID() });
      prisma.order.findUnique.mockResolvedValue(order);

      const result = await orderService.getOrder({ orderId: order.id, userId: randomUUID(), role: 'admin' });

      expect(result.id).toBe(order.id);
    });

    it('throws 404 if order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.getOrder({ orderId: randomUUID(), userId: randomUUID(), role: 'admin' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('cancelOrder', () => {
    it('customer cancels pending order and stock is restored', async () => {
      const userId = randomUUID();
      const productId = randomUUID();
      const orderId = randomUUID();
      const item = makeOrderItem({ orderId, productId, quantity: 3 });
      const order = makeOrder({ id: orderId, userId, status: 'pending', orderItems: [item] });
      const cancelledOrder = { ...order, status: 'cancelled' };

      useTx();
      prisma.$queryRaw
        .mockResolvedValueOnce([makeOrderRow(userId, { order_id: orderId, status: 'pending' })])
        .mockResolvedValueOnce([makeProductRow({ product_id: productId })]);
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.update.mockResolvedValue(cancelledOrder);

      const result = await orderService.cancelOrder({ orderId, userId, role: 'customer' });

      expect(result.status).toBe('cancelled');
      expect(prisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stockQuantity: { increment: 3 } } })
      );
    });

    it('throws 409 if order is already shipped', async () => {
      const userId = randomUUID();
      const orderId = randomUUID();
      useTx();
      prisma.$queryRaw.mockResolvedValueOnce([
        makeOrderRow(userId, { order_id: orderId, status: 'shipped' }),
      ]);

      await expect(
        orderService.cancelOrder({ orderId, userId, role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 409 if order is already cancelled', async () => {
      const userId = randomUUID();
      const orderId = randomUUID();
      useTx();
      prisma.$queryRaw.mockResolvedValueOnce([
        makeOrderRow(userId, { order_id: orderId, status: 'cancelled' }),
      ]);

      await expect(
        orderService.cancelOrder({ orderId, userId, role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 403 if customer tries to cancel another user order', async () => {
      const orderId = randomUUID();
      useTx();
      prisma.$queryRaw.mockResolvedValueOnce([
        makeOrderRow(randomUUID(), { order_id: orderId, status: 'pending' }), // different user_id
      ]);

      await expect(
        orderService.cancelOrder({ orderId, userId: randomUUID(), role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('admin can cancel any order', async () => {
      const userId = randomUUID();
      const productId = randomUUID();
      const orderId = randomUUID();
      const item = makeOrderItem({ orderId, productId, quantity: 1 });
      const order = makeOrder({ id: orderId, userId, status: 'pending', orderItems: [item] });

      useTx();
      prisma.$queryRaw
        .mockResolvedValueOnce([makeOrderRow(userId, { order_id: orderId, status: 'pending' })])
        .mockResolvedValueOnce([makeProductRow({ product_id: productId })]);
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.update.mockResolvedValue({ ...order, status: 'cancelled' });

      const result = await orderService.cancelOrder({ orderId, userId: randomUUID(), role: 'admin' });

      expect(result.status).toBe('cancelled');
    });
  });

  describe('updateOrderStatus', () => {
    it('admin advances pending → paid', async () => {
      const order = makeOrder({ status: 'paid' });
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUnique.mockResolvedValue(order);

      const result = await orderService.updateOrderStatus({
        orderId: order.id,
        status: 'paid',
        role: 'admin',
      });

      expect(result.status).toBe('paid');
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: order.id, status: 'pending' }, data: { status: 'paid' } })
      );
    });

    it('admin advances paid → shipped', async () => {
      const order = makeOrder({ status: 'shipped' });
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUnique.mockResolvedValue(order);

      const result = await orderService.updateOrderStatus({
        orderId: order.id,
        status: 'shipped',
        role: 'admin',
      });

      expect(result.status).toBe('shipped');
    });

    it('throws 403 if caller is not admin', async () => {
      await expect(
        orderService.updateOrderStatus({ orderId: randomUUID(), status: 'paid', role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 409 on invalid status transition', async () => {
      const order = makeOrder({ status: 'shipped' });
      prisma.order.updateMany.mockResolvedValue({ count: 0 }); // transition rejected
      prisma.order.findUnique.mockResolvedValue(order);

      await expect(
        orderService.updateOrderStatus({ orderId: order.id, status: 'paid', role: 'admin' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 404 if order does not exist', async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.updateOrderStatus({ orderId: randomUUID(), status: 'paid', role: 'admin' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getAllOrders', () => {
    it('admin retrieves all orders', async () => {
      const orders = [makeOrder(), makeOrder()];
      prisma.order.findMany.mockResolvedValue(orders);

      const result = await orderService.getAllOrders({ role: 'admin' });

      expect(result).toHaveLength(2);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { orderItems: true } })
      );
    });

    it('throws 403 if caller is not admin', async () => {
      await expect(
        orderService.getAllOrders({ role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
