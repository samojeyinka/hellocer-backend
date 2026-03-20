const express = require('express');
const router = express.Router();
const { submitContactForm } = require('../controllers/contact.controller');

// @route   POST /api/contact/submit
// @desc    Submit contact form
// @access  Public
router.post('/submit', submitContactForm);

module.exports = router;
