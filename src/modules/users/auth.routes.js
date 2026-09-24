const express = require('express');
const userController = require('./user.controller');
const validate = require('../../middleware/validate.middleware');
const { authRateLimit } = require('../../middleware/rateLimiter.middleware');
const userValidation = require('../../validations/user.validation');

const router = express.Router();

router.post('/signup', authRateLimit, validate(userValidation.signup), userController.signup);
router.post('/login', authRateLimit, validate(userValidation.login), userController.login);

module.exports = router;
