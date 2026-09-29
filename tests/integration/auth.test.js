// NOTE: error.middleware.js errorConverter is declared with 2 params instead of 4,
// so Express does not register it as error-handling middleware — it never runs.
// All errors are handled directly by errorHandler, which still works correctly.
// Non-ApiError errors bypass conversion but errorHandler handles them via err.statusCode||500.

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
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const prisma = require('../../src/config/prisma');
const { makeUser } = require('../helpers/factories');

describe('POST /api/auth/signup', () => {
  it('201 — creates account and returns user + token', async () => {
    const user = makeUser({ email: 'new@example.com' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);

    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'new@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('400 — missing required field (email)', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      password: 'Password1',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 — password too short', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'short',
    });

    expect(res.status).toBe(400);
  });

  it('400 — password lacks uppercase letter', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password1',
    });

    expect(res.status).toBe(400);
  });

  it('409 — duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());

    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'taken@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(409);
  });

  it('response includes X-Request-Id header', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(makeUser());

    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'req@example.com',
      password: 'Password1',
    });

    expect(res.headers['x-request-id']).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  it('200 — returns user + token on valid credentials', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const res = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'Password1',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('400 — missing email', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'Password1' });

    expect(res.status).toBe(400);
  });

  it('401 — user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(401);
  });

  it('401 — wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'WrongPassword1',
    });

    expect(res.status).toBe(401);
  });

  it('403 — deactivated account', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ isActive: false }));

    const res = await request(app).post('/api/auth/login').send({
      email: 'inactive@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(403);
  });
});
