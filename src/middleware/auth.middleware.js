const { verifyToken } = require('../modules/users/jwt.util');
const ApiError = require('../utils/apiError');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const { middlewareResult } = require('./log.middleware');

// Verifies the JWT and attaches the current user to req.user
const protect = catchAsync(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not authenticated. No token provided.');
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new ApiError(401, 'User belonging to this token no longer exists.');
    }

    if (user.isActive === false) {
      throw new ApiError(403, 'This account has been deactivated');
    }

    req.user = user;
    middlewareResult(req, { middleware: 'auth', result: 'allowed' });
    next();
  } catch (error) {
    middlewareResult(req, {
      middleware: 'auth',
      result: 'rejected',
      statusCode: error.statusCode || 401,
      reason: error.message,
    });
    throw error;
  }
});

module.exports = { protect };