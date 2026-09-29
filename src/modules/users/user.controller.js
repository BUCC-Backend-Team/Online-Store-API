const userService = require('./user.service');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/apiResponse');
 
const signup = catchAsync(async (req, res) => {
  const { user, token } = await userService.signup(req.body);
  sendResponse(res, 201, 'Account created successfully', { user, token });
});
 
const login = catchAsync(async (req, res) => {
  const { user, token } = await userService.login(req.body);
  sendResponse(res, 200, 'Logged in successfully', { user, token });
});
 
 
const getMe = catchAsync(async (req, res) => {
  const user = await userService.getById(req.user.id);
  sendResponse(res, 200, 'Profile retrieved successfully', user);
});
 
const updateMe = catchAsync(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  sendResponse(res, 200, 'Profile updated successfully', user);
});
 
const getAllUsers = catchAsync(async (req, res) => {
  const users = await userService.getAllUsers();
  sendResponse(res, 200, 'Users retrieved successfully', users);
});
 
const getUserById = catchAsync(async (req, res) => {
  const user = await userService.getById(req.params.id);
  sendResponse(res, 200, 'User retrieved successfully', user);
});
  
const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUser(req.params.id);
  sendResponse(res, 200, 'User deleted successfully');
});
 
module.exports = {
  signup,
  login,
  getMe,
  updateMe,
  getAllUsers,
  getUserById,
  deleteUser,
};