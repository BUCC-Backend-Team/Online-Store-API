const express = require('express');
const authController = require('./auth.controller');
const validate = require('../../middleware/validate.middleware');
const { moduleHit } = require('../../middleware/log.middleware');
const authValidation = require('../../validations/auth.validation');

const router = express.Router();
const hit = moduleHit('auth');

router.post('/signup', validate(authValidation.signup), hit, authController.signup);
router.post('/login', validate(authValidation.login), hit, authController.login);

module.exports = router;