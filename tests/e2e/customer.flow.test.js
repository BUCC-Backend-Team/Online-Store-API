/**
 * E2E — Customer Journey
 *
 * PREREQUISITES (real infrastructure required):
 *   1. PostgreSQL test DB running, schema migrated:
 *        npx prisma migrate deploy
 *   2. Upstash Redis (or local Redis compatible with @upstash/redis REST API)
 *   3. .env.test in project root:
 *        DATABASE_URL=postgresql://user:pass@localhost:5432/online_store_test
 *        JWT_SECRET=<any long secret>
 *        UPSTASH_REDIS_REST_URL=<url>
 *        UPSTASH_REDIS_REST_TOKEN=<token>
 *   4. At least one active product seeded:
 *        npx prisma db seed
 *
 * Run e2e only:
 *   jest --testPathPattern=e2e --setupFiles ./tests/setup/e2e-env.js
 *
 * Each test suite is isolated: each signup uses a unique email so suites
 * can run in any order without cleanup between them.
 */

const request = require('supertest');
const app = require('../../src/app');

const UNIQUE = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const CUSTOMER = {
  name: 'E2E Customer',
  email: `e2e-customer-${UNIQUE}@example.com`,
  password: 'Password1',
};

let token;
let seededProductId;
let orderId;

// ──────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────

describe('Customer flow: auth', () => {
  it('signs up successfully', async () => {
    const res = await request(app).post('/api/auth/signup').send(CUSTOMER);

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    token = res.body.data.token;
  });

  it('cannot sign up twice with same email', async () => {
    const res = await request(app).post('/api/auth/signup').send(CUSTOMER);
    expect(res.status).toBe(409);
  });

  it('logs in and receives new token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: CUSTOMER.email,
      password: CUSTOMER.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    token = res.body.data.token; // use this token for subsequent requests
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: CUSTOMER.email,
      password: 'WrongPassword1',
    });
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// Profile
// ──────────────────────────────────────────────

describe('Customer flow: profile', () => {
  it('views own profile', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(CUSTOMER.email);
    expect(res.body.data.password).toBeUndefined();
  });

  it('updates own name', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Customer Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('E2E Customer Updated');
  });

  it('cannot list all users (admin only)', async () => {
    const res = await request(app)
      .get('/api/users/')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────
// Products
// ──────────────────────────────────────────────

describe('Customer flow: browse products', () => {
  it('lists products (active only)', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.products.length).toBeGreaterThan(0);
    res.body.data.products.forEach((p) => expect(p.isActive).toBe(true));
    seededProductId = res.body.data.products[0].id;
  });

  it('cannot create a product (admin only)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'CUST-HACK', name: 'Hack', price: '1.00', stockQuantity: 1 });

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────
// Orders
// ──────────────────────────────────────────────

describe('Customer flow: place and cancel order', () => {
  it('places order successfully', async () => {
    expect(seededProductId).toBeDefined();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: seededProductId, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe('pending');
    orderId = res.body.data.order.id;
  });

  it('views own order list', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.some((o) => o.id === orderId)).toBe(true);
  });

  it('views specific order', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.order.id).toBe(orderId);
  });

  it('cancels own order and stock is restored', async () => {
    // Record stock before cancel
    const beforeRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
    const productBefore = beforeRes.body.data.products.find((p) => p.id === seededProductId);
    const stockBefore = productBefore?.stockQuantity;

    const cancelRes = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.order.status).toBe('cancelled');

    // Stock should be restored
    const afterRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
    const productAfter = afterRes.body.data.products.find((p) => p.id === seededProductId);
    if (stockBefore !== undefined && productAfter) {
      expect(productAfter.stockQuantity).toBe(stockBefore + 1);
    }
  });

  it('cannot cancel same order twice', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('cannot place order on out-of-stock product (quantity > stock)', async () => {
    const listRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
    const product = listRes.body.data.products[0];

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: product.stockQuantity + 1000 }] });

    expect(res.status).toBe(409);
  });
});
