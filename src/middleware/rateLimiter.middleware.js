const redis = require('../config/redis');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const { middlewareResult } = require('./log.middleware');

const QUOTA_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const clientAddress = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const createRateLimiter = ({ max, windowMs, keyPrefix, keyFn, failClosed }) => {
  return async (req, res, next) => {
    const key = `${keyPrefix}:${keyFn(req)}`;

    try {
      const result = await redis.eval(QUOTA_SCRIPT, [key], [String(windowMs)]);
      const count = Number(Array.isArray(result) ? result[0] : result);
      const ttlMs = Number(Array.isArray(result) ? result[1] : windowMs);
      const remaining = Math.max(0, max - count);
      const resetSeconds = Math.max(1, Math.ceil((Number.isFinite(ttlMs) ? ttlMs : windowMs) / 1000));

      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(resetSeconds));

      if (count > max) {
        res.setHeader('Retry-After', String(resetSeconds));
        middlewareResult(req, {
          middleware: 'rateLimit',
          result: 'rejected',
          statusCode: 429,
          reason: 'Rate limit exceeded',
        });
        return next(new ApiError(429, 'Too many requests. Please try again later.'));
      }

      middlewareResult(req, { middleware: 'rateLimit', result: 'allowed' });
      return next();
    } catch (error) {
      if (failClosed) {
        middlewareResult(req, {
          middleware: 'rateLimit',
          result: 'rejected',
          statusCode: 503,
          reason: 'Rate limiter unavailable',
        });
        return next(new ApiError(503, 'Login is temporarily unavailable. Please try again later.'));
      }

      logger.warn('rate limiter bypassed', {
        event: 'middleware.result',
        middleware: 'rateLimit',
        result: 'allowed',
        reason: error.message,
      });
      return next();
    }
  };
};

const rateLimit = createRateLimiter({
  max: toPositiveInt(process.env.RATE_LIMIT_MAX, 100),
  windowMs: toPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  keyPrefix: 'rl:user',
  keyFn: (req) => (req.user?.id != null ? String(req.user.id) : clientAddress(req)),
  failClosed: false,
});

const authRateLimit = createRateLimiter({
  max: toPositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 10),
  windowMs: toPositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  keyPrefix: 'rl:auth',
  keyFn: clientAddress,
  failClosed: true,
});

module.exports = { rateLimit, authRateLimit };
