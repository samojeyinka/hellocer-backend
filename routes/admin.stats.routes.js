const express = require('express');
const router = express.Router();
const statsController = require('../controllers/admin.stats.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo } = require('../middleware/roleCheck.middleware');

router.get('/dashboard', protect, restrictTo('super-admin', 'admin'), statsController.getDashboardStats);
router.get('/weekly-revenue', protect, restrictTo('super-admin', 'admin'), statsController.getWeeklyRevenue);
router.get('/income-stats', protect, restrictTo('super-admin', 'admin'), statsController.getIncomeStats);
router.get('/ongoing-projects', protect, restrictTo('super-admin', 'admin'), statsController.getOngoingProjects);

module.exports = router;
