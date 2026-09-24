const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { generateToken } = require('./jwt.util');

const SALT_ROUNDS = 10;

const signup = async ({ name, email, password }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  const token = generateToken(user);

  return { user: sanitizeUser(user), token };
};

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = generateToken(user);

  return { user: sanitizeUser(user), token };
};


const getById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return sanitizeUser(user);
};

const updateProfile = async (id, updates) => {
  // Only allow a safe, explicit set of fields to be self-updated
  const { name, email } = updates;
  const data = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== id) {
      throw new ApiError(409, 'That email is already in use');
    }
  }

  const user = await prisma.user.update({ where: { id }, data });
  return sanitizeUser(user);
};


const getAllUsers = async () => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(sanitizeUser);
};


const deleteUser = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  await prisma.user.delete({ where: { id } });
};

// ─── Helpers ─────────────────────────────────────────────

// Never send the password hash back to the client
const sanitizeUser = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

module.exports = {
  signup,
  login,
  getById,
  updateProfile,
  getAllUsers,
  updateUserRole,
  deleteUser,
};