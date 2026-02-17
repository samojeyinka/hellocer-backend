const User = require('../models/user.model');
const Order = require('../models/order.model');
const EmailService = require('../services/email.service');
const NotificationService = require('../services/notification.service');

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { firstName, lastName, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, profilePicture },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

exports.deleteOwnAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check for active orders
    const activeOrders = await Order.find({
      $or: [
        { clientId: userId },
        { gigCreatorId: userId },
        { hellocians: userId }
      ],
      status: { $in: ['pending', 'in-progress'] }
    });

    if (activeOrders.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete account with active orders. Please complete or cancel them first.'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

// Admin/Super-Admin: Block user
exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Super-admin cannot be blocked
    if (user.role === 'super-admin') {
      return res.status(403).json({ error: 'Cannot block super admin' });
    }

    // Only super-admin can block admin
    if (user.role === 'admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only super admin can block admins' });
    }

    user.isBlocked = true;
    user.blockedBy = req.user._id;
    user.blockedAt = new Date();
    await user.save();

    // Send email notification
    await EmailService.sendAccountBlockedEmail(user.email, user.firstName, reason);

    // Create notification
    await NotificationService.createNotification({
      userId: user._id,
      type: 'account_blocked',
      title: 'Account Blocked',
      message: reason ? `Your account has been blocked. Reason: ${reason}` : 'Your account has been blocked.',
      relatedId: req.user._id,
      relatedModel: 'User'
    });

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
};

// Admin/Super-Admin: Unblock user
exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isBlocked = false;
    user.blockedBy = undefined;
    user.blockedAt = undefined;
    await user.save();

    await NotificationService.createNotification({
      userId: user._id,
      type: 'account_unblocked',
      title: 'Account Unblocked',
      message: 'Your account has been unblocked. You can now access all features.',
      relatedId: req.user._id,
      relatedModel: 'User'
    });

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
};

// Admin/Super-Admin: Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete super-admin
    if (user.role === 'super-admin') {
      return res.status(403).json({ error: 'Cannot delete super admin' });
    }

    // Only super-admin can delete admin
    if (user.role === 'admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only super admin can delete admins' });
    }

    // Check for active orders
    const activeOrders = await Order.find({
      $or: [
        { clientId: userId },
        { gigCreatorId: userId },
        { hellocians: userId }
      ],
      status: { $in: ['pending', 'in-progress'] }
    });

    if (activeOrders.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete user with active orders'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Admin/Super-Admin: Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { role, isBlocked, page = 1, limit = 20 } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};