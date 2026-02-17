const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const gooleAppleAuthController = require('../controllers/google_apple_auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register', authController.register);
router.post('/google', gooleAppleAuthController.googleAuth);
router.post('/google', gooleAppleAuthController.appleAuth);
router.post('/twitter', gooleAppleAuthController.twitterAuth);
router.post('/activate', authController.activateAccount);
router.post('/resend-activation', authController.resendActivationCode);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshAccessToken);
router.post('/logout', protect, authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', protect, authController.getMe);


module.exports = router;