const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');

const router = express.Router();

router.use('/auth', authRoutes);
// router.use('/users', userRoutes);      // next module
// router.use('/products', productRoutes); // next module
// router.use('/orders', orderRoutes);     // next module

module.exports = router;