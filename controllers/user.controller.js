const User = require('../models/user.model');
const Order = require('../models/order.model');
const EmailService = require('../services/email.service');
const NotificationService = require('../services/notification.service');

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      firstName, lastName, profilePicture, 
      address, city, postalCode, country, timeZone 
    } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        firstName, lastName, profilePicture,
        address, city, postalCode, country, timeZone 
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword, code } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP
    if (user.settingsChangeCode !== code || user.settingsChangeCodeExpires < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    // Assign new password, pre-save hook handles hashing
    user.password = newPassword;
    user.settingsChangeCode = undefined;
    user.settingsChangeCodeExpires = undefined;
    user.refreshToken = null; // Logout
    await user.save();

    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

exports.requestSettingsChange = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { generateSixAlphabetCode } = require('../utils/generateCode');
    
    const otp = generateSixAlphabetCode(); 
    user.settingsChangeCode = otp;
    user.settingsChangeCodeExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    await EmailService.sendSettingsChangeOTP(user.email, user.firstName, otp);

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Request settings change error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
};

exports.changeEmail = async (req, res) => {
  try {
    const { newEmail, code } = req.body;
    const user = await User.findById(req.user._id);

    if (user.settingsChangeCode !== code || user.settingsChangeCodeExpires < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    user.email = newEmail;
    user.settingsChangeCode = undefined;
    user.settingsChangeCodeExpires = undefined;
    user.refreshToken = null; // Logout
    await user.save();

    res.json({ success: true, message: 'Email updated successfully. Please log in again.' });
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ error: 'Failed to change email' });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { 
      emailNotifications, directMessages, clientReview, 
      clientNewRegistration, hellocianactivities, 
      emailSupportTickets, projectUpdates, timeZone 
    } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        emailNotifications, directMessages, clientReview, 
        clientNewRegistration, hellocianactivities, 
        emailSupportTickets, projectUpdates, timeZone 
      },
      { new: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};

exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const existingUser = await User.findOne({ 
      username: username.toLowerCase(),
      _id: { $ne: req.user?._id } 
    });

    res.json({ 
      success: true, 
      available: !existingUser 
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ error: 'Failed to check username availability' });
  }
};

exports.updateUsername = async (req, res) => {
  try {
    const { username, code } = req.body;
    const userId = req.user._id;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await User.findById(userId);
    if (user.settingsChangeCode !== code || user.settingsChangeCodeExpires < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Validate username format (alphanumeric and underscore, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores' 
      });
    }

    const existingUser = await User.findOne({ 
      username: username.toLowerCase(),
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    user.username = username.toLowerCase();
    user.settingsChangeCode = undefined;
    user.settingsChangeCodeExpires = undefined;
    await user.save();

    res.json({ success: true, user: user.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } }) });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({ error: 'Failed to update username' });
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

// ── Bookmarks ─────────────────────────────────────────────────────────────────

exports.toggleBookmark = async (req, res) => {
  try {
    const userId = req.user._id;
    const { gigId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isBookmarked = user.savedGigs.some(id => id.toString() === gigId);

    if (isBookmarked) {
      user.savedGigs = user.savedGigs.filter(id => id.toString() !== gigId);
    } else {
      user.savedGigs.push(gigId);
    }

    await user.save();
    res.json({ success: true, bookmarked: !isBookmarked });
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
};

exports.getSavedGigs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'savedGigs',
        match: { deletedAt: null, isActive: true, status: 'published' },
        populate: [
          { path: 'creator', select: 'firstName lastName username profilePicture' },
          { path: 'category', select: 'name slug' }
        ]
      });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, gigs: user.savedGigs.filter(Boolean) });
  } catch (error) {
    console.error('Get saved gigs error:', error);
    res.status(500).json({ error: 'Failed to get saved gigs' });
  }
};

exports.getBookmarkedIds = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('savedGigs');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, savedGigs: user.savedGigs });
  } catch (error) {
    console.error('Get bookmarked ids error:', error);
    res.status(500).json({ error: 'Failed to get bookmarked ids' });
  }
};