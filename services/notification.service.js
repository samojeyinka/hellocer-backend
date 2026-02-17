const Notification = require('../models/notification.model');
const SocketService = require('./socket.service');

class NotificationService {
  async createNotification(notificationData) {
    try {
      const notification = await Notification.create(notificationData);
      
      const populatedNotification = await Notification.findById(notification._id)
        .populate('userId', 'firstName lastName');

      // Emit real-time notification
      SocketService.emitToUser(notificationData.userId, 'notification:new', populatedNotification);

      return notification;
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  async createBulkNotifications(notifications) {
    try {
      const createdNotifications = await Notification.insertMany(notifications);
      
      // Emit to each user
      for (const notification of createdNotifications) {
        SocketService.emitToUser(notification.userId, 'notification:new', notification);
      }

      return createdNotifications;
    } catch (error) {
      console.error('Create bulk notifications error:', error);
      throw error;
    }
  }

  async getUserNotifications(userId, page = 1, limit = 20) {
    try {
      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const total = await Notification.countDocuments({ userId });
      const unread = await Notification.countDocuments({ userId, isRead: false });

      return {
        notifications,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        },
        unread
      };
    } catch (error) {
      console.error('Get notifications error:', error);
      throw error;
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      if (notification) {
        SocketService.emitToUser(userId, 'notification:read', { notificationId });
      }

      return notification;
    } catch (error) {
      console.error('Mark notification as read error:', error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      SocketService.emitToUser(userId, 'notifications:all_read', {});
    } catch (error) {
      console.error('Mark all as read error:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      await Notification.findOneAndDelete({ _id: notificationId, userId });
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();