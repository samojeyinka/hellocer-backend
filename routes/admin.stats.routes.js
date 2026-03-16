const express = require('express');
const router = express.Router();
const statsController = require('../controllers/admin.stats.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo } = require('../middleware/roleCheck.middleware');

router.get('/dashboard', protect, restrictTo('super-admin', 'admin'), statsController.getDashboardStats);

module.exports = router;
