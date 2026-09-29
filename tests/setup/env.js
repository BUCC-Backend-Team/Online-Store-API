// Sets required env vars before any module loads.
// dotenv.config() inside config/env.js does NOT override existing process.env values,
// so these take precedence over any .env file present in the repo.
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/online_store_test';
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_MAX = '100';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.AUTH_RATE_LIMIT_MAX = '10';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '900000';
