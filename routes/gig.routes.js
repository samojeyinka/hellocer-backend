const express = require('express');
const router = express.Router();
const gigController = require('../controllers/gig.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkActivation } = require('../middleware/roleCheck.middleware');

router.get('/', gigController.getAllGigs);
router.get('/:gigId', gigController.getGigById);
router.get('/slug/:slug', gigController.getGigBySlug);

router.use(protect, checkActivation);

// Admin/Super-Admin routes
router.use(restrictTo('admin', 'super-admin'));
router.post('/', gigController.createGig);
router.put('/:gigId', gigController.updateGig);
router.delete('/:gigId', gigController.deleteGig);
router.patch('/:gigId/toggle-orders', gigController.toggleAcceptingOrders);

module.exports = router;