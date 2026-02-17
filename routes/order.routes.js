const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkActivation } = require('../middleware/roleCheck.middleware');
const { 
  getUserOrders, 
  getAllOrders,
  getOrderById, 
  updateOrderStatus, 
  cancelOrder 
} = require('../controllers/order.controller');

router.use(protect, checkActivation);

// User's own orders
router.get('/', getUserOrders);

// Get specific order
router.get('/:orderId', getOrderById);

// Update order status
router.patch('/:orderId/status', updateOrderStatus);

// Cancel order
router.post('/:orderId/cancel', cancelOrder);

// Admin only - get all orders with stats
router.get('/admin/all', restrictTo('admin', 'super-admin'), getAllOrders);

module.exports = router;