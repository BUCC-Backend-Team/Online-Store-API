const express = require('express');
const userController = require('./user.controller');
const validate = require('../../middlewares/validate.middleware');
const { protect } = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const userValidation = require('../../validations/user.validation');
const ROLES = require('../../constants/roles');

const router = express.Router();

// router.post('/signup', validate(userValidation.signup), userController.signup);
// router.post('/login', validate(userValidation.login), userController.login);

router.get('/me', protect, userController.getMe);
router.patch('/me', protect, validate(userValidation.updateProfile), userController.updateMe);

router.get('/', protect, authorize(ROLES.ADMIN), userController.getAllUsers);
router.get('/:id', protect, authorize(ROLES.ADMIN), userController.getUserById);

router.delete('/:id', protect, authorize(ROLES.ADMIN), userController.deleteUser);

module.exports = router;