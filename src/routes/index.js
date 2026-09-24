const express = require('express');
const authRoutes = require('../modules/users/auth.routes');
const userRoutes = require('../modules/users/user.routes');
const productRoutes = require('../modules/product/product.routes');
const orderRoutes = require('../modules/order/order.routes');
 
const router = express.Router();
 
router.use('/auth', authRoutes);   // signup, login
router.use('/users', userRoutes);  // profile + admin user management
router.use('/products', productRoutes); // next module
router.use('/orders', orderRoutes);     // next module
 
module.exports = router;