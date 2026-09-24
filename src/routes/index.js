const express = require('express');
const userRoutes = require('../modules/users/user.routes');

const router = express.Router();

router.use('/users', userRoutes); // includes /signup, /login, /me, and admin routes
// router.use('/products', productRoutes); // next module
// router.use('/orders', orderRoutes);     // next module

module.exports = router;