const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const orderRoutes = require('../modules/order/order.routes');

const router = express.Router();

router.use('/auth', authRoutes);
// router.use('/users', userRoutes);      // next module
// router.use('/products', productRoutes); // next module
router.use('/orders', orderRoutes);

module.exports = router;