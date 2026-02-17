const express = require('express');
const router = express.Router();
const { createPayment, executePayment, refundPayment } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkActivation } = require('../middleware/roleCheck.middleware');


router.use(protect, checkActivation);


router.post('/create', createPayment);
router.post('/execute', executePayment);

router.post('/refund', restrictTo('user','admin', 'super-admin'), refundPayment);

module.exports = router;