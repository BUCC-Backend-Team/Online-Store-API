// E2E runs against real infrastructure, so values come from the environment
// (e.g. `npx dotenv-cli -e .env.test -- npm run test:e2e`).
// Unlike env.js, this only fills in defaults and never overrides what is already set.
const defaults = {
  JWT_SECRET: 'test-jwt-secret-must-be-at-least-32-chars-long',
  DATABASE_URL: 'postgresql://testuser:testpassword@localhost:5433/online_store_test',
  UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
  PORT: '3001',
  NODE_ENV: 'test',
  RATE_LIMIT_MAX: '1000',
  RATE_LIMIT_WINDOW_MS: '900000',
  AUTH_RATE_LIMIT_MAX: '1000',
  AUTH_RATE_LIMIT_WINDOW_MS: '900000',
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
