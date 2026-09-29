const bcrypt = require('bcryptjs');

jest.mock('bcryptjs');
jest.mock('../../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require('../../src/config/prisma');
const userService = require('../../src/modules/users/user.service');
const { makeUser, makeAdmin } = require('../helpers/factories');

describe('userService', () => {
  describe('signup', () => {
    it('creates user and returns sanitized user + JWT', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed-pw');
      prisma.user.create.mockResolvedValue(user);

      const result = await userService.signup({ name: user.name, email: user.email, password: 'Password1' });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(result.token).toBeDefined();
      expect(result.user.password).toBeUndefined();
      expect(result.user.email).toBe(user.email);
    });

    it('throws 409 if email already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());

      await expect(
        userService.signup({ name: 'Test', email: 'taken@example.com', password: 'Password1' })
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('password is hashed before storing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed-pw');
      prisma.user.create.mockResolvedValue(makeUser());

      await userService.signup({ name: 'Test', email: 'new@example.com', password: 'Password1' });

      expect(bcrypt.hash).toHaveBeenCalledWith('Password1', 10);
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).toBe('hashed-pw');
    });
  });

  describe('login', () => {
    it('returns sanitized user + JWT on valid credentials', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(true);

      const result = await userService.login({ email: user.email, password: 'Password1' });

      expect(result.user.password).toBeUndefined();
      expect(result.token).toBeDefined();
    });

    it('throws 401 if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        userService.login({ email: 'nobody@example.com', password: 'Password1' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 if password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        userService.login({ email: 'test@example.com', password: 'WrongPassword1' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 403 if account is deactivated', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ isActive: false }));
      // bcrypt.compare is not called — check happens before password comparison
      await expect(
        userService.login({ email: 'test@example.com', password: 'Password1' })
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns sanitized user', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await userService.getById(user.id);

      expect(result.id).toBe(user.id);
      expect(result.password).toBeUndefined();
    });

    it('throws 404 if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.getById('non-existent-id')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateProfile', () => {
    it('updates name only', async () => {
      const user = makeUser({ name: 'Updated Name' });
      prisma.user.update.mockResolvedValue(user);

      const result = await userService.updateProfile(user.id, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(result.password).toBeUndefined();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Updated Name' } })
      );
    });

    it('updates email only after checking for conflicts', async () => {
      const user = makeUser({ email: 'new@example.com' });
      prisma.user.findUnique.mockResolvedValue(null); // no conflict
      prisma.user.update.mockResolvedValue(user);

      const result = await userService.updateProfile(user.id, { email: 'new@example.com' });

      expect(result.email).toBe('new@example.com');
    });

    it('throws 409 if new email is taken by another user', async () => {
      const otherUser = makeUser({ id: 'other-id', email: 'taken@example.com' });
      prisma.user.findUnique.mockResolvedValue(otherUser);

      await expect(
        userService.updateProfile('my-id', { email: 'taken@example.com' })
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('allows keeping same email (own record, no conflict)', async () => {
      const userId = 'my-id';
      const user = makeUser({ id: userId, email: 'mine@example.com' });
      prisma.user.findUnique.mockResolvedValue(user); // same id → service skips conflict
      prisma.user.update.mockResolvedValue(user);

      await expect(
        userService.updateProfile(userId, { email: 'mine@example.com' })
      ).resolves.not.toThrow();
    });
  });

  describe('getAllUsers', () => {
    it('returns array of sanitized users ordered by createdAt desc', async () => {
      const users = [makeUser(), makeAdmin()];
      prisma.user.findMany.mockResolvedValue(users);

      const result = await userService.getAllUsers();

      expect(result).toHaveLength(2);
      result.forEach((u) => expect(u.password).toBeUndefined());
      expect(prisma.user.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    });
  });

  describe('deleteUser', () => {
    it('soft deletes by setting isActive=false', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, isActive: false });

      await userService.deleteUser(user.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { isActive: false },
      });
    });

    it('throws 404 if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.deleteUser('non-existent')).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
