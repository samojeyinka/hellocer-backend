const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quote.controller'); 
const { protect } = require('../middleware/auth.middleware');
const { restrictTo } = require('../middleware/roleCheck.middleware');

router.post('/', quoteController.sendQuote);
router.get('/', protect, restrictTo('super-admin', 'admin'), quoteController.getQuotes);
router.post('/:quoteId/reply', protect, restrictTo('super-admin', 'admin'), quoteController.replyToQuote);

module.exports = router;
