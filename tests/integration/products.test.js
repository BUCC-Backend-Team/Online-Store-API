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
const { makeUser, makeAdmin, makeProduct, makeProductRow } = require('../helpers/factories');
const { bearerToken } = require('../helpers/auth');

describe('POST /api/products (admin only)', () => {
  it('201 — admin creates product', async () => {
    const admin = makeAdmin();
    const product = makeProduct({ sku: 'NEW-001' });
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.product.create.mockResolvedValue(product);

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', bearerToken(admin))
      .send({ sku: 'NEW-001', name: 'Widget', price: '19.99', stockQuantity: 50 });

    expect(res.status).toBe(201);
    expect(res.body.data.product.sku).toBe(product.sku);
    expect(res.body.data.product.price).toMatch(/^\d+\.\d{2}$/);
  });

  it('403 — customer cannot create products', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', bearerToken(user))
      .send({ sku: 'X', name: 'Y', price: '5', stockQuantity: 1 });

    expect(res.status).toBe(403);
  });

  it('400 — missing required fields', async () => {
    const admin = makeAdmin();
    prisma.user.findUnique.mockResolvedValue(admin);

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', bearerToken(admin))
      .send({ name: 'Widget' }); // missing sku, price, stockQuantity

    expect(res.status).toBe(400);
  });

  it('400 — invalid price format (more than 2 decimal places)', async () => {
    const admin = makeAdmin();
    prisma.user.findUnique.mockResolvedValue(admin);

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', bearerToken(admin))
      .send({ sku: 'X', name: 'Y', price: '9.999', stockQuantity: 1 });

    expect(res.status).toBe(400);
  });

  it('409 — duplicate SKU', async () => {
    const admin = makeAdmin();
    const err = new Error('Unique constraint');
    err.code = 'P2002';
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.product.create.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', bearerToken(admin))
      .send({ sku: 'DUP-001', name: 'Widget', price: '9.99', stockQuantity: 10 });

    expect(res.status).toBe(409);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ sku: 'X', name: 'Y', price: '5', stockQuantity: 1 });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/products', () => {
  it('200 — customer sees only active products', async () => {
    const user = makeUser();
    const activeProducts = [makeProduct(), makeProduct()];
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.product.findMany.mockResolvedValue(activeProducts);
    prisma.product.count.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
    const findManyCall = prisma.product.findMany.mock.calls[0][0];
    expect(findManyCall.where).toEqual({ isActive: true });
  });

  it('200 — admin sees all products including inactive', async () => {
    const admin = makeAdmin();
    const allProducts = [makeProduct(), makeProduct({ isActive: false })];
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.product.findMany.mockResolvedValue(allProducts);
    prisma.product.count.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(2);
    const findManyCall = prisma.product.findMany.mock.calls[0][0];
    expect(findManyCall.where).toEqual({});
  });

  it('400 — invalid pagination params', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .get('/api/products?page=0')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(400);
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/products/:sku', () => {
  it('200 — returns active product', async () => {
    const user = makeUser();
    const product = makeProduct({ sku: 'FIND-001' });
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.product.findUnique.mockResolvedValue(product);

    const res = await request(app)
      .get('/api/products/FIND-001')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(200);
    expect(res.body.data.product.sku).toBe(product.sku);
  });

  it('404 — product not found', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.product.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/products/MISSING-SKU')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(404);
  });

  it('404 — customer cannot see inactive product', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.product.findUnique.mockResolvedValue(makeProduct({ isActive: false }));

    const res = await request(app)
      .get('/api/products/INACTIVE-SKU')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/products/:sku (admin only)', () => {
  it('200 — admin updates product', async () => {
    const admin = makeAdmin();
    const product = makeProduct({ name: 'Updated Widget' });
    const row = makeProductRow({ product_id: product.id });
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.$queryRaw.mockResolvedValue([row]);
    prisma.product.update.mockResolvedValue(product);

    const res = await request(app)
      .patch(`/api/products/${product.sku}`)
      .set('Authorization', bearerToken(admin))
      .send({ name: 'Updated Widget' });

    expect(res.status).toBe(200);
    expect(res.body.data.product.name).toBe('Updated Widget');
  });

  it('403 — customer cannot update product', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .patch('/api/products/TEST-SKU')
      .set('Authorization', bearerToken(user))
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('400 — empty update body rejected', async () => {
    const admin = makeAdmin();
    prisma.user.findUnique.mockResolvedValue(admin);

    const res = await request(app)
      .patch('/api/products/TEST-SKU')
      .set('Authorization', bearerToken(admin))
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/products/:sku/deactivate (admin only)', () => {
  it('200 — admin deactivates product', async () => {
    const admin = makeAdmin();
    const product = makeProduct({ isActive: false });
    const row = makeProductRow({ product_id: product.id });
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.$queryRaw.mockResolvedValue([row]);
    prisma.product.update.mockResolvedValue(product);

    const res = await request(app)
      .post(`/api/products/${product.sku}/deactivate`)
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.product.isActive).toBe(false);
  });

  it('403 — customer cannot deactivate products', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/products/TEST-SKU/deactivate')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(403);
  });
});
