const express = require('express');
const authController = require('./auth.controller');
const validate = require('../../middleware/validate.middleware');
const authValidation = require('../../validations/auth.validation');

const router = express.Router();

router.post('/signup', validate(authValidation.signup), authController.signup);
router.post('/login', validate(authValidation.login), authController.login);

module.exports = router;