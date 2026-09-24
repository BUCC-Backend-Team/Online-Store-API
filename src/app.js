const express = require('express');
const requestId = require('./middlewares/requestId.middleware');
const { errorConverter, errorHandler } = require('./middlewares/error.middleware');
const routes = require('./routes');

const app = express();

app.use(express.json());
app.use(requestId);

app.use('/api', routes);

// 404 handler for unmatched routes
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling (must be last)
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;