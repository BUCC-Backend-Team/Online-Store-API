/**
 * E2E — Admin Journey
 *
 * PREREQUISITES: same as customer.flow.test.js
 * Requires a seeded admin account matching ADMIN_EMAIL / ADMIN_PASSWORD in .env.test
 * (created by: npx prisma db seed)
 *
 * Run:
 *   jest --testPathPattern=e2e --setupFiles ./tests/setup/e2e-env.js
 */

const request = require('supertest');
const app = require('../../src/app');

const UNIQUE = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@example.com',
  password: process.env.ADMIN_PASSWORD || 'Admin@Password1',
};

const CUSTOMER = {
  name: 'E2E Customer for Admin Tests',
  email: `e2e-admin-test-customer-${UNIQUE}@example.com`,
  password: 'Password1',
};

const SKU = `E2E-SKU-${UNIQUE}`;

let adminToken;
let customerToken;
let customerId;
let productId;
let orderId;

// ──────────────────────────────────────────────
// Admin auth
// ──────────────────────────────────────────────

describe('Admin flow: auth', () => {
  it('admin logs in successfully', async () => {
    const res = await request(app).post('/api/auth/login').send(ADMIN);

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
    adminToken = res.body.data.token;
  });
});

// ──────────────────────────────────────────────
// User management
// ──────────────────────────────────────────────

describe('Admin flow: user management', () => {
  beforeAll(async () => {
    // Sign up a customer to manage
    const res = await request(app).post('/api/auth/signup').send(CUSTOMER);
    customerToken = res.body.data.token;
    customerId = res.body.data.user.id;
  });

  it('lists all users', async () => {
    const res = await request(app)
      .get('/api/users/')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((u) => expect(u.password).toBeUndefined());
  });

  it('looks up specific user by id', async () => {
    const res = await request(app)
      .get(`/api/users/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(customerId);
  });

  it('deactivates (soft-deletes) a user', async () => {
    const res = await request(app)
      .delete(`/api/users/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('deactivated user can no longer log in', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: CUSTOMER.email,
      password: CUSTOMER.password,
    });

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────
// Product management
// ──────────────────────────────────────────────

describe('Admin flow: product management', () => {
  it('creates a product', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: SKU,
        name: 'E2E Test Widget',
        description: 'Created during e2e test run',
        price: '29.99',
        stockQuantity: 25,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.product.sku).toBe(SKU);
    expect(res.body.data.product.price).toBe('29.99');
    productId = res.body.data.product.id;
  });

  it('cannot create product with duplicate SKU', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: SKU, name: 'Duplicate', price: '1.00', stockQuantity: 1 });

    expect(res.status).toBe(409);
  });

  it('lists all products including inactive', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.products.some((p) => p.sku === SKU)).toBe(true);
  });

  it('updates product price and stock', async () => {
    const res = await request(app)
      .patch(`/api/products/${SKU}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: '34.99', stockQuantity: 20 });

    expect(res.status).toBe(200);
    expect(res.body.data.product.price).toBe('34.99');
    expect(res.body.data.product.stockQuantity).toBe(20);
  });

  it('deactivates product', async () => {
    const res = await request(app)
      .post(`/api/products/${SKU}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.product.isActive).toBe(false);
  });

  it('deactivated product is invisible to customers', async () => {
    // Sign up a fresh customer (previous one was deactivated)
    const signupRes = await request(app).post('/api/auth/signup').send({
      name: 'Fresh Customer',
      email: `fresh-${UNIQUE}@example.com`,
      password: 'Password1',
    });
    const freshToken = signupRes.body.data.token;

    const res = await request(app)
      .get(`/api/products/${SKU}`)
      .set('Authorization', `Bearer ${freshToken}`);

    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────
// Order management
// ──────────────────────────────────────────────

describe('Admin flow: order management', () => {
  let activeProductSku;

  beforeAll(async () => {
    // Create fresh product and customer for order tests
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: `ORDER-PROD-${UNIQUE}`,
        name: 'Order Test Product',
        price: '10.00',
        stockQuantity: 50,
      });
    activeProductSku = prodRes.body.data.sku;
    const activeProductId = prodRes.body.data.id;

    // Create fresh customer
    const custRes = await request(app).post('/api/auth/signup').send({
      name: 'Order Customer',
      email: `order-cust-${UNIQUE}@example.com`,
      password: 'Password1',
    });
    customerToken = custRes.body.data.token;

    // Place order as customer
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: activeProductId, quantity: 2 }] });
    orderId = orderRes.body.data.id;
  });

  it('views all orders across all users', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.some((o) => o.id === orderId)).toBe(true);
  });

  it('views a specific order', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.order.id).toBe(orderId);
  });

  it('advances order status pending → paid', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'paid' });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('paid');
  });

  it('advances order status paid → shipped', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'shipped' });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('shipped');
  });

  it('cannot advance past shipped (no valid transition)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'paid' }); // shipped → paid is not allowed

    expect(res.status).toBe(409);
  });

  it('cannot cancel a shipped order', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });
});
