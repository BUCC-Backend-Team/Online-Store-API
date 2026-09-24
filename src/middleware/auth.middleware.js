const { verifyToken } = require('../modules/auth/jwt.util');
const ApiError = require('../utils/apiError');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

// Verifies the JWT and attaches the current user to req.user
const protect = catchAsync(async (req, res, next) => {
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

  req.user = user;
  next();
});

module.exports = { protect };