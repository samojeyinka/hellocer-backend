const express = require('express');
const router = express.Router();
const gigController = require('../controllers/gig.controller');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const { restrictTo, checkActivation } = require('../middleware/roleCheck.middleware');

// ── Public routes ──────────────────────────────────────────────────────────────
router.get('/tags', gigController.getAllTags);
router.get('/', gigController.getAllGigs);
router.get('/slug/:slug', optionalProtect, gigController.getGigBySlug);
router.get('/:gigId/similar', optionalProtect, gigController.getSimilarGigs);
router.get('/:gigId', optionalProtect, gigController.getGigById);

// ── Protected (admin / super-admin) routes ─────────────────────────────────────
router.use(protect, checkActivation, restrictTo('admin', 'super-admin'));

router.get('/admin/all', gigController.getAdminGigs);        // filtered admin listing
router.post('/', gigController.createGig);
router.post('/:gigId/duplicate', gigController.duplicateGig);
router.put('/:gigId', gigController.updateGig);
router.delete('/:gigId', gigController.deleteGig);           // soft delete
router.delete('/:gigId/permanent', gigController.hardDeleteGig);
router.patch('/:gigId/toggle-active', gigController.toggleActive);
router.patch('/:gigId/restore', gigController.restoreGig);
router.patch('/:gigId/toggle-orders', gigController.toggleAcceptingOrders);

module.exports = router;