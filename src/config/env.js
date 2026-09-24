require('dotenv').config({ quiet: true });

const missing = ['JWT_SECRET', 'DATABASE_URL'].filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const parsedPort = Number(process.env.PORT);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

module.exports = {
  port,
  jwtSecret: process.env.JWT_SECRET,
};
