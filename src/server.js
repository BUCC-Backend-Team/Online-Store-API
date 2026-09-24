const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');
 
app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port} `);
});
 