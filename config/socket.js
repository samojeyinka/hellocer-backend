const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

let io;
const connectedUsers = new Map(); // userId -> socketId

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.firstName} (${socket.user._id})`);
    
    // Store user connection
    connectedUsers.set(socket.user._id.toString(), socket.id);

    // Emit online status
    socket.broadcast.emit('user:online', { userId: socket.user._id });

    // Join user to their personal room
    socket.join(`user:${socket.user._id}`);

    // Join chat room
    socket.on('chat:join', (chatId) => {
      socket.join(`chat:${chatId}`);
      console.log(`User ${socket.user._id} joined chat ${chatId}`);
    });

    // Leave chat room
    socket.on('chat:leave', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    // Typing indicator
    socket.on('chat:typing', ({ chatId, isTyping }) => {
      socket.to(`chat:${chatId}`).emit('user:typing', {
        userId: socket.user._id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        isTyping
      });
    });

    // Mark messages as read
    socket.on('messages:read', ({ chatId, messageIds }) => {
      socket.to(`chat:${chatId}`).emit('messages:read', {
        userId: socket.user._id,
        messageIds,
        readAt: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user._id}`);
      connectedUsers.delete(socket.user._id.toString());
      socket.broadcast.emit('user:offline', { userId: socket.user._id });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

const getSocketId = (userId) => {
  return connectedUsers.get(userId.toString());
};

module.exports = {
  initializeSocket,
  getIO,
  isUserOnline,
  getSocketId
};