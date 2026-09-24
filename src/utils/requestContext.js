const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

const runWithRequest = (context, callback) => storage.run(context, callback);

const getRequestContext = () => storage.getStore();

module.exports = { runWithRequest, getRequestContext };
