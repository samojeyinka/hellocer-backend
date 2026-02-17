const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');
const { checkActivation } = require('../middleware/roleCheck.middleware');

router.get('/gig/:gigId', reviewController.getGigReviews);

router.use(protect, checkActivation);

router.post('/', reviewController.createReview);
router.put('/:reviewId', reviewController.updateReview);
router.delete('/:reviewId', reviewController.deleteReview);
router.post('/:reviewId/respond', reviewController.respondToReview);

module.exports = router;