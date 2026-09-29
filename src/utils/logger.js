const { getRequestContext } = require('./requestContext');

const write = (level, message, fields = {}) => {
  const context = getRequestContext() || {};
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
    requestId: fields.requestId ?? context.requestId,
  };

  for (const key of Object.keys(entry)) {
    if (entry[key] === undefined) {
      delete entry[key];
    }
  }

  const line = `${JSON.stringify(entry)}\n`;
  if (level === 'error') {
    process.stderr.write(line);
    return;
  }
  process.stdout.write(line);
};

const logger = {
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
};

module.exports = logger;
