const jwt = require('jsonwebtoken');

const makeToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const bearerToken = (user) => `Bearer ${makeToken(user)}`;

module.exports = { makeToken, bearerToken };
