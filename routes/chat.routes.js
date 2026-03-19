const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');
const { checkActivation } = require('../middleware/roleCheck.middleware');

router.use(protect, checkActivation);

router.post('/direct', chatController.createDirectChat);
router.post('/:chatId/call', chatController.initiateCall);
router.get('/', chatController.getUserChats);
router.get('/:chatId', chatController.getChatById);
router.patch('/:chatId/participants/add', chatController.addParticipant);
router.patch('/:chatId/participants/remove', chatController.removeParticipant);
router.delete('/:chatId', chatController.deleteChat);

module.exports = router;