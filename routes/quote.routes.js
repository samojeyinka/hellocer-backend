const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quote.controller');

router.post('/', quoteController.sendQuote);

module.exports = router;
