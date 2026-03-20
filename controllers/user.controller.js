const User = require('../models/user.model');
const Order = require('../models/order.model');
const Gig = require('../models/gig.model');
const Review = require('../models/review.model');
const Chat = require('../models/chat.model');
const Message = require('../models/message.model');
const EmailService = require('../services/email.service');
const NotificationService = require('../services/notification.service');

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = {};
    const allowedFields = [
      'firstName', 'lastName', 'profilePicture', 
      'address', 'city', 'postalCode', 'country', 'timeZone', 'socials',
      'bio', 'skills'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
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
    const { role, isBlocked, page = 1, limit = 20, search } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

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

exports.getTopHellocians = async (req, res) => {
  try {
    const hellocians = await User.find({
      role: 'hellocian',
      isActivated: true,
      directMessages: true
    }).select('firstName lastName profilePicture skills');

    const results = await Promise.all(hellocians.map(async (h) => {
      // Completed tasks
      const completedTasks = await Order.countDocuments({
        hellocians: h._id,
        status: 'completed'
      });

      // Gigs attached to
      const attachedGigs = await Gig.find({ hellocians: h._id }).select('_id');
      const gigIds = attachedGigs.map(g => g._id);

      // Reviews for these gigs
      let rating = 0;
      let reviewsCount = 0;

      if (gigIds.length > 0) {
        const reviews = await Review.find({ gigId: { $in: gigIds } });
        reviewsCount = reviews.length;
        if (reviewsCount > 0) {
          const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
          rating = parseFloat((sum / reviewsCount).toFixed(1));
        }
      }

      return {
        _id: h._id,
        name: `${h.firstName} ${h.lastName}`,
        role: h.skills && h.skills.length > 0 ? h.skills[0] : 'Professional',
        skills: h.skills,
        avatar: h.profilePicture,
        tasks: completedTasks,
        rating: rating || 5.0,
        reviews: reviewsCount,
        verified: true
      };
    }));

    results.sort((a, b) => b.rating - a.rating || b.tasks - a.tasks);

    res.json({ success: true, hellocians: results });
  } catch (error) {
    console.error('Get top hellocians error:', error);
    res.status(500).json({ error: 'Failed to fetch top hellocians' });
  }
};

exports.getHellocianMetrics = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Inbox Response Rate & Time
    const chats = await Chat.find({ participants: userId });
    
    let totalDirectChats = 0;
    let directChatsWithReply = 0;
    let totalReplyTimeMs = 0;
    let replyCount = 0;

    let totalOrderChats = 0;
    let orderChatsWithReply = 0;

    for (const chat of chats) {
      const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });
      
      if (chat.chatType === 'direct') {
        totalDirectChats++;
        let hasRepliedAtLeastOnce = false;
        
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          // If message is from someone else
          if (msg.senderId.toString() !== userId.toString()) {
            // Find next message from Hellocian
            const nextHellocianMsg = messages.slice(i + 1).find(m => m.senderId.toString() === userId.toString());
            if (nextHellocianMsg) {
              const diffMs = nextHellocianMsg.createdAt - msg.createdAt;
              totalReplyTimeMs += diffMs;
              replyCount++;
              if (diffMs <= 60 * 60 * 1000) { // Replied within 1 hour
                hasRepliedAtLeastOnce = true;
              }
            }
          }
        }
        if (hasRepliedAtLeastOnce) directChatsWithReply++;
      } else if (chat.chatType === 'order') {
        totalOrderChats++;
        const hellocianReplied = messages.some(m => m.senderId.toString() === userId.toString());
        if (hellocianReplied) orderChatsWithReply++;
      }
    }

    const inboxResponseRate = Math.round(
      ((directChatsWithReply + orderChatsWithReply) / (totalDirectChats + totalOrderChats || 1)) * 100
    );
    const avgResponseTimeHrs = replyCount > 0 ? (totalReplyTimeMs / replyCount / (1000 * 60 * 60)).toFixed(1) : 0;

    // 2. Order Response Rate (Orders vs Gigs ratio)
    const gigsCount = await Gig.countDocuments({ hellocians: userId, deletedAt: null });
    const ordersCount = await Order.countDocuments({ hellocians: userId });
    const orderResponseRate = Math.round((ordersCount / (gigsCount || 1)) * 100);

    // 3. Delivered on Time
    const userGigs = await Gig.find({ hellocians: userId }).distinct('_id');
    const reviews = await Review.find({ gigId: { $in: userGigs } });
    const onTimeReviews = reviews.filter(r => ['fast', 'extra-fast', 'express'].includes(r.deliverySpeed));
    const deliveredOnTimeRate = Math.round((onTimeReviews.length / (reviews.length || 1)) * 100);

    // 4. Order Completion
    const activeOrders = await Order.countDocuments({ hellocians: userId });
    const completedOrders = await Order.countDocuments({ hellocians: userId, status: 'completed' });
    const orderCompletionRate = Math.round((completedOrders / (activeOrders || 1)) * 100);

    // 5. Total Earnings (Completed orders + PAID additional payments)
    const userOrders = await Order.find({ hellocians: userId, status: 'completed' });
    let totalEarnings = 0;
    for (const order of userOrders) {
      totalEarnings += order.price;
      if (order.additionalPayments) {
        order.additionalPayments.forEach(p => {
          if (p.status === 'paid') totalEarnings += p.amount;
        });
      }
    }

    // 6. Average Rating
    const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : 0;

    res.json({
      success: true,
      metrics: {
        inbox: Math.min(inboxResponseRate, 100),
        responseTime: parseFloat(avgResponseTimeHrs),
        order: Math.min(orderResponseRate, 100),
        delivered: Math.min(deliveredOnTimeRate, 100),
        completion: Math.min(orderCompletionRate, 100),
        totalEarnings,
        avgRating: parseFloat(avgRating)
      }
    });
  } catch (error) {
    console.error('Get hellocian metrics error:', error);
    res.status(500).json({ error: 'Failed to calculate metrics' });
  }
};