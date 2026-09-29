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
const { makeUser, makeAdmin } = require('../helpers/factories');
const { bearerToken } = require('../helpers/auth');

describe('GET /api/users/me', () => {
  it('200 — returns own profile (password excluded)', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user); // used by both protect + getById

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.password).toBeUndefined();
  });

  it('401 — no token provided', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
  });

  it('401 — malformed token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer not-a-valid-jwt');

    expect(res.status).toBe(401);
  });

  it('401 — user deleted after token issued', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(null); // protect middleware: user gone

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('200 — updates own profile', async () => {
    const user = makeUser({ name: 'Updated Name' });
    prisma.user.findUnique.mockResolvedValue(null); // email conflict check: none
    prisma.user.update.mockResolvedValue(user);

    // protect middleware also calls findUnique — make it return the user
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.email) return null; // conflict check
      return user; // protect + getById calls
    });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('400 — empty body (at least one field required)', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({});

    expect(res.status).toBe(400);
  });

  it('400 — invalid email format', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/users/ (admin only)', () => {
  it('200 — admin gets list of all users', async () => {
    const admin = makeAdmin();
    const users = [makeUser(), makeUser(), admin];
    prisma.user.findUnique.mockResolvedValue(admin); // protect
    prisma.user.findMany.mockResolvedValue(users);

    const res = await request(app)
      .get('/api/users/')
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    res.body.data.forEach((u) => expect(u.password).toBeUndefined());
  });

  it('403 — customer cannot list users', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .get('/api/users/')
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app).get('/api/users/');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/:id (admin only)', () => {
  it('200 — admin looks up another user', async () => {
    const admin = makeAdmin();
    const target = makeUser({ email: 'target@example.com' });
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === admin.id) return admin;
      if (where.id === target.id) return target;
      return null;
    });

    const res = await request(app)
      .get(`/api/users/${target.id}`)
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(target.id);
  });

  it('403 — customer cannot look up other users', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .get(`/api/users/${makeUser().id}`)
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/users/:id (admin only)', () => {
  it('200 — admin soft-deletes a user', async () => {
    const admin = makeAdmin();
    const target = makeUser({ email: 'todelete@example.com' });
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === admin.id) return admin;
      if (where.id === target.id) return target;
      return null;
    });
    prisma.user.update.mockResolvedValue({ ...target, isActive: false });

    const res = await request(app)
      .delete(`/api/users/${target.id}`)
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });

  it('403 — customer cannot delete users', async () => {
    const user = makeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .delete(`/api/users/${makeUser().id}`)
      .set('Authorization', bearerToken(user));

    expect(res.status).toBe(403);
  });

  it('404 — target user not found', async () => {
    const admin = makeAdmin();
    const missingId = '00000000-0000-0000-0000-000000000000';
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === admin.id) return admin;
      return null;
    });

    const res = await request(app)
      .delete(`/api/users/${missingId}`)
      .set('Authorization', bearerToken(admin));

    expect(res.status).toBe(404);
  });
});
