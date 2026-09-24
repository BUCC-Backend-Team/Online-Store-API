const express = require('express');
const userController = require('./user.controller');
const validate = require('../../middleware/validate.middleware');
const { protect } = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/rbac.middleware');
const { rateLimit, authRateLimit } = require('../../middleware/rateLimiter.middleware');
const userValidation = require('../../validations/user.validation');
const ROLES = require('../../constants/roles');

const router = express.Router();

// router.post('/signup', authRateLimit, validate(userValidation.signup), userController.signup);
// router.post('/login', authRateLimit, validate(userValidation.login), userController.login);

router.get('/me', protect, rateLimit, userController.getMe);
router.patch('/me', protect, rateLimit, validate(userValidation.updateProfile), userController.updateMe);

router.get('/', protect, authorize(ROLES.ADMIN), rateLimit, userController.getAllUsers);
router.get('/:id', protect, authorize(ROLES.ADMIN), rateLimit, userController.getUserById);

router.delete('/:id', protect, authorize(ROLES.ADMIN), rateLimit, userController.deleteUser);

module.exports = router;