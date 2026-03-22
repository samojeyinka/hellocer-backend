const Chat = require('../models/chat.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const EmailService = require('../services/email.service');
const { isUserOnline } = require('../config/socket');

exports.addParticipant = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userIdToAdd } = req.body;

    // Verify requester is admin or super-admin
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Permission denied. Only admins can add participants.' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.chatType !== 'order') {
      return res.status(400).json({ error: 'Participants can only be added to order chats' });
    }

    // Verify user exists
    const userToAdd = await User.findById(userIdToAdd);
    if (!userToAdd) {
      return res.status(404).json({ error: 'User to add not found' });
    }

    // Check if already a participant
    if (chat.participants.some(p => p.toString() === userIdToAdd)) {
      return res.status(400).json({ error: 'User is already a participant' });
    }

    chat.participants.push(userIdToAdd);
    await chat.save();

    // Send email notification
    try {
      if (chat.orderId) {
        const Order = mongoose.model('Order');
        const order = await Order.findById(chat.orderId);
        if (order) {
          await EmailService.sendOrderAssignmentEmail(userToAdd.email, userToAdd.firstName, {
            orderId: order._id.toString(),
            title: order.title
          });
        }
      }
    } catch (emailError) {
      console.error('Failed to send participant addition email:', emailError);
      // Don't fail the request if email sending fails
    }

    res.json({ success: true, message: 'Participant added successfully' });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
};

exports.removeParticipant = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userIdToRemove } = req.body;

    // Verify requester is admin or super-admin
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Permission denied. Only admins can remove participants.' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.chatType !== 'order') {
      return res.status(400).json({ error: 'Participants can only be removed from order chats' });
    }

    chat.participants = chat.participants.filter(
      p => p.toString() !== userIdToRemove
    );
    await chat.save();

    // Send email notification
    try {
      const userToRemove = await User.findById(userIdToRemove);
      if (userToRemove && chat.orderId) {
        const Order = mongoose.model('Order');
        const order = await Order.findById(chat.orderId);
        if (order) {
          await EmailService.sendOrderRemovalEmail(userToRemove.email, userToRemove.firstName, {
            orderId: order._id.toString(),
            title: order.title
          });
        }
      }
    } catch (emailError) {
      console.error('Failed to send participant removal email:', emailError);
      // Don't fail the request if email sending fails
    }

    res.json({ success: true, message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
};

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

    // const emailPromises = otherParticipants.map(participant => 
    //   EmailService.sendCallInvitation(participant.email, participant.firstName, {
    //     callerName,
    //     roomID,
    //     callType
    //   })
    // );

    // await Promise.all(emailPromises);

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