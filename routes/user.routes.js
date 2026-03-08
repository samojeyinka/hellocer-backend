const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkActivation } = require('../middleware/roleCheck.middleware');

router.use(protect, checkActivation);

router.put('/profile', userController.updateProfile);
router.post('/request-settings-change', userController.requestSettingsChange);
router.put('/change-password', userController.changePassword);
router.put('/email', userController.changeEmail);
router.put('/preferences', userController.updatePreferences);
router.get('/check-username', userController.checkUsernameAvailability);
router.put('/username', userController.updateUsername);
router.delete('/account', userController.deleteOwnAccount);
router.get('/:userId', userController.getUserById);

// Admin/Super-Admin routes
router.use(restrictTo('admin', 'super-admin'));
router.get('/', userController.getAllUsers);
router.put('/:userId/block', userController.blockUser);
router.put('/:userId/unblock', userController.unblockUser);
router.delete('/:userId', userController.deleteUser);

module.exports = router;
