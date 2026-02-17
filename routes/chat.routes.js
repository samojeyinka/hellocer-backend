const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');
const { checkActivation } = require('../middleware/roleCheck.middleware');

router.use(protect, checkActivation);

router.post('/direct', chatController.createDirectChat);
router.get('/', chatController.getUserChats);
router.get('/:chatId', chatController.getChatById);
router.delete('/:chatId', chatController.deleteChat);

module.exports = router;