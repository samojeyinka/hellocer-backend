const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkActivation } = require('../middleware/roleCheck.middleware');

const twoFactorController = require('../controllers/2fa.controller');

router.use(protect, checkActivation);

// 2FA Routes
router.post('/2fa/generate', twoFactorController.generate2FA);
router.post('/2fa/verify-setup', twoFactorController.verifySetup);
router.post('/2fa/disable', twoFactorController.disable2FA);

router.put('/profile', userController.updateProfile);
router.post('/request-settings-change', userController.requestSettingsChange);
router.put('/change-password', userController.changePassword);
router.put('/email', userController.changeEmail);
router.put('/preferences', userController.updatePreferences);
router.get('/check-username', userController.checkUsernameAvailability);
router.put('/username', userController.updateUsername);
router.delete('/account', userController.deleteOwnAccount);

// Bookmark routes (must come before /:userId to avoid conflicts)
router.get('/bookmarks', userController.getSavedGigs);
router.get('/bookmarks/ids', userController.getBookmarkedIds);
router.post('/bookmarks/:gigId', userController.toggleBookmark);

router.get('/:userId', userController.getUserById);

// Admin/Super-Admin routes
router.use(restrictTo('admin', 'super-admin'));
router.get('/', userController.getAllUsers);
router.put('/:userId/block', userController.blockUser);
router.put('/:userId/unblock', userController.unblockUser);
router.delete('/:userId', userController.deleteUser);

module.exports = router;
