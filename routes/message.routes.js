const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { protect } = require('../middleware/auth.middleware');
const { checkActivation } = require('../middleware/roleCheck.middleware');

router.use(protect, checkActivation);

router.post('/', messageController.sendMessage);
router.get('/chat/:chatId', messageController.getChatMessages);
router.patch('/chat/:chatId/read', messageController.markMessagesAsRead);

module.exports = router;