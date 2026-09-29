const express = require('express');
const requestId = require('./middleware/requestId.middleware');
const { errorConverter, errorHandler } = require('./middleware/error.middleware');
const { middlewareResult } = require('./middleware/log.middleware');
const routes = require('./routes');

const app = express();

app.use(requestId);
app.use(express.json());

app.use('/api', routes);

// 404 handler for unmatched routes
app.use((req, res) => {
  middlewareResult(req, {
    middleware: 'router',
    result: 'rejected',
    statusCode: 404,
    reason: 'Route not found',
  });
  res.status(404).json({ success: false, message: 'Route not found', requestId: req.id });
});

// Error handling (must be last)
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;