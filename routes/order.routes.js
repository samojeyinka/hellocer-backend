const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkActivation } = require('../middleware/roleCheck.middleware');
const { 
  getUserOrders, 
  getAllOrders,
  getOrderById, 
  updateOrderStatus, 
  cancelOrder,
  extendOrderDeliveryTime,
  updateOrderHellocians,
  remindReview
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

// Extend delivery time
router.patch('/:orderId/extend', restrictTo('admin', 'super-admin'), extendOrderDeliveryTime);

// Update Hellocians
router.patch('/:orderId/hellocians', restrictTo('admin', 'super-admin'), updateOrderHellocians);

// Remind for review
router.post('/:orderId/remind-review', restrictTo('admin', 'super-admin'), remindReview);

// Admin only - get all orders with stats
router.get('/admin/all', restrictTo('admin', 'super-admin'), getAllOrders);

module.exports = router;