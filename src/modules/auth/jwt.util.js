const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('../../utils/apiError');

const generateToken = (user) => {
  return jwt.sign(
    { sub: user.id, role: user.role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.jwt.secret);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired token');
  }
};

module.exports = { generateToken, verifyToken };