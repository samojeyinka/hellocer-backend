const Message = require('../models/message.model');
const Chat = require('../models/chat.model');
const SocketService = require('../services/socket.service');
const NotificationService = require('../services/notification.service');

exports.sendMessage = async (req, res) => {
  try {
    const { chatId, content, attachments } = req.body;
    const senderId = req.user._id;

    const chat = await Chat.findById(chatId).populate('participants');
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Verify sender is participant
    const isParticipant = chat.participants.some(
      p => p._id.toString() === senderId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant of this chat' });
    }

    const message = await Message.create({
      chatId,
      senderId,
      content,
      attachments: attachments || [],
      isRead: [{ userId: senderId, readAt: new Date() }]
    });

    // Update chat's last message
    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'firstName lastName profilePicture role');

    // Emit real-time notification
    const participantIds = chat.participants.map(p => p._id);
    SocketService.notifyNewMessage(chatId, populatedMessage, participantIds);

    /* 
    // Create notification for other participants
    const otherParticipants = chat.participants.filter(
      p => p._id.toString() !== senderId.toString()
    );

    for (const participant of otherParticipants) {
      await NotificationService.createNotification({
        userId: participant._id,
        type: 'message_received',
        title: 'New Message',
        message: `${req.user.firstName} ${req.user.lastName} sent you a message`,
        relatedId: chatId,
        relatedModel: 'Chat'
      });
    }
    */

    res.status(201).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Verify user is participant
    const isParticipant = chat.participants.some(
      p => p.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({ chatId })
      .populate('senderId', 'firstName lastName profilePicture role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({ chatId });

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

exports.markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Update all unread messages in the chat
    const messages = await Message.find({
      chatId,
      'isRead.userId': { $ne: userId }
    });

    const messageIds = [];
    for (const message of messages) {
      message.isRead.push({ userId, readAt: new Date() });
      await message.save();
      messageIds.push(message._id);
    }

    // Notify other participants via socket
    SocketService.emitToChat(chatId, 'messages:read', {
      userId,
      messageIds,
      readAt: new Date()
    });

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};