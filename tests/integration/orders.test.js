const { randomUUID } = require('crypto');

jest.mock('../../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  product: {
    create: jest.fn(), findMany: jest.fn(), count: jest.fn(),
    findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
  },
  order: {
    findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    update: jest.fn(), updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
}));

jest.mock('../../src/middleware/rateLimiter.middleware', () => ({
  rateLimit: (req, res, next) => next(),
  authRateLimit: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/config/prisma');
const { makeUser, makeAdmin, makeOrder, makeOrderItem, makeProductRow, makeOrderRow } = require('../helpers/factories');
const { bearerToken } = require('../helpers/auth');

describe('POST /api/orders (customer only)', () => {
  it('201 — customer places order successfully', async () => {
    const user = makeUser();
    const productId = randomUUID();
    const item = makeOrderItem({ productId, quantity: 2 });
    const order = makeOrder({ userId: user.id, orderItems: [item] });

    prisma.user.findUnique.mockResolvedValue(user); // protect + tx user check
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.$queryRaw.mockResolvedValue([
      makeProductRow({ product_id: productId, price: '9.99', stock_quantity: 50 }),
    ]);
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.create.mockResolvedValue(order);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', bearerToken(user))
      .send({ items: [{ productId, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe('pending');
    expect(res.body.data.order.items).toHaveLength(1);
  });

  it('400 — empty items array', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', bearerToken(user))
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  it('400 — duplicate productId in items', async () => {
    const user = makeUser();
    const productId = randomUUID();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', bearerToken(user))
      .send({ items: [{ productId, quantity: 1 }, { productId, quantity: 2 }] });

    expect(res.status).toBe(400);
  });

  it('403 — admin cannot place orders', async () => {
    const admin = makeAdmin();
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.$queryRaw.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', bearerToken(admin))
      .send({ items: [{ productId: randomUUID(), quantity: 1 }] });

    expect(res.status).toBe(403);
  });

  it('409 — insufficient stock', async () => {
    const user = makeUser();
    const productId = randomUUID();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.$queryRaw.mockResolvedValue([
      makeProductRow({ product_id: productId, stock_quantity: 1 }), // only 1 available
    ]);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', bearerToken(user))
      .send({ items: [{ productId, quantity: 5 }] });

    expect(res.status).toBe(409);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: randomUUID(), quantity: 1 }] });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders', () => {
  it('200 — customer gets own orders only', async () => {
    const user = makeUser();
    const orders = [makeOrder({ userId: user.id }), makeOrder({ userId: user.id })];
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.order.findMany.mockResolvedValue(orders);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(2);
    const findCall = prisma.order.findMany.mock.calls[0][0];
    expect(findCall.where).toEqual({ userId: user.id });
  });

  it('200 — admin gets all orders', async () => {
    const admin = makeAdmin();
    const orders = [makeOrder(), makeOrder(), makeOrder()];
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.order.findMany.mockResolvedValue(orders);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(3);
  });
});

describe('GET /api/orders/:id', () => {
  it('200 — customer views own order', async () => {
    const user = makeUser();
    const order = makeOrder({ userId: user.id });
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.order.findUnique.mockResolvedValue(order);

    const res = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(200);
    expect(res.body.data.order.id).toBe(order.id);
  });

  it("403 — customer cannot view another user's order", async () => {
    const user = makeUser();
    const order = makeOrder({ userId: randomUUID() }); // different user
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.order.findUnique.mockResolvedValue(order);

    const res = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(403);
  });

  it('200 — admin views any order', async () => {
    const admin = makeAdmin();
    const order = makeOrder({ userId: randomUUID() });
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.order.findUnique.mockResolvedValue(order);

    const res = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(200);
    // admin sees any order
  });

  it('400 — invalid UUID in param', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .get('/api/orders/not-a-uuid')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(400);
  });

  it('404 — order not found', async () => {
    const admin = makeAdmin();
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.order.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/orders/${randomUUID()}`)
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/orders/:id/cancel', () => {
  it('200 — customer cancels own pending order', async () => {
    const user = makeUser();
    const productId = randomUUID();
    const orderId = randomUUID();
    const item = makeOrderItem({ orderId, productId, quantity: 1 });
    const order = makeOrder({ id: orderId, userId: user.id, status: 'pending', orderItems: [item] });
    const cancelled = { ...order, status: 'cancelled' };

    prisma.user.findUnique.mockResolvedValue(user);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.$queryRaw
      .mockResolvedValueOnce([makeOrderRow(user.id, { order_id: orderId, status: 'pending' })])
      .mockResolvedValueOnce([makeProductRow({ product_id: productId })]);
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.update.mockResolvedValue(cancelled);

    const res = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('cancelled');
  });

  it('409 — cannot cancel shipped order', async () => {
    const user = makeUser();
    const orderId = randomUUID();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.$queryRaw.mockResolvedValueOnce([
      makeOrderRow(user.id, { order_id: orderId, status: 'shipped' }),
    ]);

    const res = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(409);
  });

  it('400 — invalid UUID in param', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/orders/not-a-uuid/cancel')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/orders/:id/status (admin only)', () => {
  it('200 — admin advances order pending → paid', async () => {
    const admin = makeAdmin();
    const order = makeOrder({ status: 'paid' });
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUnique.mockResolvedValue(order);

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set('Authorization', bearerToken(admin))
      .send({ status: 'paid' });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('paid');
  });

  it('400 — invalid status value', async () => {
    const admin = makeAdmin();
    prisma.user.findUnique.mockResolvedValue(admin);

    const res = await request(app)
      .patch(`/api/orders/${randomUUID()}/status`)
      .set('Authorization', bearerToken(admin))
      .send({ status: 'pending' }); // 'pending' is not a valid transition target

    expect(res.status).toBe(400);
  });

  it('403 — customer cannot update order status', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .patch(`/api/orders/${randomUUID()}/status`)
      .set('Authorization', bearerToken(user))
      .send({ status: 'paid' });

    expect(res.status).toBe(403);
  });

  it('409 — invalid status transition (shipped → paid)', async () => {
    const admin = makeAdmin();
    const order = makeOrder({ status: 'shipped' });
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.order.updateMany.mockResolvedValue({ count: 0 });
    prisma.order.findUnique.mockResolvedValue(order);

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set('Authorization', bearerToken(admin))
      .send({ status: 'paid' });

    expect(res.status).toBe(409);
  });
});
