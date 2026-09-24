const authService = require('./auth.service');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/apiResponse');

const signup = catchAsync(async (req, res) => {
  const { user, token } = await authService.signup(req.body);
  sendResponse(res, 201, 'Account created successfully', { user, token });
});

const login = catchAsync(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  sendResponse(res, 200, 'Logged in successfully', { user, token });
});

module.exports = { signup, login };