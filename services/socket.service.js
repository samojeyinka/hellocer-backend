const { getIO, isUserOnline } = require('../config/socket');

class SocketService {
  emitToUser(userId, event, data) {
    try {
      const io = getIO();
      io.to(`user:${userId}`).emit(event, data);
    } catch (error) {
      console.error('Error emitting to user:', error);
    }
  }

  emitToChat(chatId, event, data) {
    try {
      const io = getIO();
      io.to(`chat:${chatId}`).emit(event, data);
    } catch (error) {
      console.error('Error emitting to chat:', error);
    }
  }

  emitToMultipleUsers(userIds, event, data) {
    try {
      const io = getIO();
      userIds.forEach(userId => {
        io.to(`user:${userId}`).emit(event, data);
      });
    } catch (error) {
      console.error('Error emitting to multiple users:', error);
    }
  }

  notifyNewMessage(chatId, message, participants) {
    this.emitToChat(chatId, 'message:new', message);
    
    // Also emit to user rooms for notification badges
    participants.forEach(participantId => {
      if (participantId.toString() !== message.senderId.toString()) {
        this.emitToUser(participantId, 'notification:message', {
          chatId,
          message
        });
      }
    });
  }

  notifyOrderUpdate(orderId, orderData, userIds) {
    this.emitToMultipleUsers(userIds, 'order:updated', {
      orderId,
      ...orderData
    });
  }

  notifyNewOrder(orderData, userIds) {
    this.emitToMultipleUsers(userIds, 'order:created', orderData);
  }

  isUserOnline(userId) {
    return isUserOnline(userId);
  }
}

module.exports = new SocketService();