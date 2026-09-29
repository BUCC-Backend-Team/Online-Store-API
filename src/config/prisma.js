const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const basePrisma = new PrismaClient();

const logQuery = async ({ model, operation, args, query }) => {
  const startedAt = Date.now();

  try {
    const result = await query(args);
    logger.info('db query executed', {
      event: 'db.query',
      model,
      operation,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    logger.error('db query failed', {
      event: 'db.query',
      model,
      operation,
      durationMs: Date.now() - startedAt,
      error: error.message,
    });
    throw error;
  }
};

// Query arguments are omitted so passwords, tokens, and row data stay out of the logs.
const prisma = basePrisma.$extends({
  query: {
    $allOperations: logQuery,
  },
});

module.exports = prisma;
