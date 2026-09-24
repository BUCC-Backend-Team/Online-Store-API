const jwt = require('jsonwebtoken');
const ApiError = require('../../utils/apiError');
const env = require('../../config/env');

const generateToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: '7d' });

const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
};

module.exports = { generateToken, verifyToken };
