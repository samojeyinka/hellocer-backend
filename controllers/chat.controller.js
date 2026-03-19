const Chat = require('../models/chat.model');
const User = require('../models/user.model');
const EmailService = require('../services/email.service');
const { isUserOnline } = require('../config/socket');

exports.createDirectChat = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user._id;

    if (senderId.toString() === recipientId) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Check if recipient allows direct messaging
    if (!recipient.directMessages) {
      return res.status(403).json({ 
        error: 'This user has disabled direct messaging' 
      });
    }

    // Check if chat already exists
    const existingChat = await Chat.findOne({
      chatType: 'direct',
      participants: { $all: [senderId, recipientId] }
    }).populate('participants', 'firstName lastName profilePicture role directMessages')
      .populate('lastMessage');

    if (existingChat) {
      return res.json({ success: true, chat: existingChat });
    }

    // Create new chat
    const newChat = await Chat.create({
      participants: [senderId, recipientId],
      chatType: 'direct'
    });

    const populatedChat = await Chat.findById(newChat._id)
      .populate('participants', 'firstName lastName profilePicture role directMessages')
      .populate('lastMessage');

    res.status(201).json({ success: true, chat: populatedChat });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
};

exports.getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({
      participants: userId
    })
      .populate('participants', 'firstName lastName profilePicture role directMessages')
      .populate('lastMessage')
      .populate('orderId', 'title status img')
      .sort({ updatedAt: -1 });
    const chatsWithOnlineStatus = chats.map(chat => {
      const chatObj = chat.toObject();
      chatObj.participants = chatObj.participants.map(p => ({
        ...p,
        isOnline: isUserOnline(p._id)
      }));
      return chatObj;
    });

    res.json({ success: true, chats: chatsWithOnlineStatus });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
};

exports.getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId)
      .populate('participants', 'firstName lastName profilePicture role directMessages')
      .populate('lastMessage')
      .populate('orderId', 'title status gigId img');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const chatObj = chat.toObject();
    chatObj.participants = chatObj.participants.map(p => ({
      ...p,
      isOnline: isUserOnline(p._id)
    }));

    res.json({ success: true, chat: chatObj });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
};

exports.initiateCall = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { callType, roomID } = req.body;
    const callerId = req.user._id;

    const chat = await Chat.findById(chatId).populate('participants');
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Verify caller is participant
    const isParticipant = chat.participants.some(
      p => p._id.toString() === callerId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this chat' });
    }

    const caller = await User.findById(callerId);
    const callerName = `${caller.firstName} ${caller.lastName}`;

    // Send email invitations to all other participants
    const otherParticipants = chat.participants.filter(
      p => p._id.toString() !== callerId.toString()
    );

    const emailPromises = otherParticipants.map(participant => 
      EmailService.sendCallInvitation(participant.email, participant.firstName, {
        callerName,
        roomID,
        callType
      })
    );

    await Promise.all(emailPromises);

    res.json({ success: true, message: 'Call invitations sent' });
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Only allow deletion of direct chats
    if (chat.chatType !== 'direct') {
      return res.status(403).json({ 
        error: 'Cannot delete order chats' 
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Chat.findByIdAndDelete(chatId);
    res.json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
};