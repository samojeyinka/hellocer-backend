const User = require('../models/user.model');
const EmailService = require('../services/email.service');


exports.getAdmins = async (req, res) => {
  try {
    const adminQuery = { 
      role: { $in: ['admin', 'super-admin'] },
      _id: { $ne: req.user._id }, 
      deletedAt: null
    };

    const admins = await User.find(adminQuery)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: admins.length,
      admins
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admins', details: error.message });
  }
};


exports.getTrashedAdmins = async (req, res) => {
  try {
    const admins = await User.find({ 
      role: { $in: ['admin', 'super-admin'] }, 
      _id: { $ne: req.user._id }, 
      deletedAt: { $ne: null } 
    })
      .select('-password -refreshToken')
      .sort({ deletedAt: -1 });

    res.json({
      success: true,
      count: admins.length,
      admins
    });
  } catch (error) {
    console.error('Get trashed admins error:', error);
    res.status(500).json({ error: 'Failed to fetch trashed admins', details: error.message });
  }
};


exports.toggleBlockAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Safety check - cannot block self
    if (id === req.user._id.toString()) {
        return res.status(403).json({ error: 'You cannot block yourself' });
    }

    const admin = await User.findOne({ _id: id, role: { $in: ['admin', 'super-admin'] }, deletedAt: null });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    admin.isBlocked = !admin.isBlocked;
    
    const displayName = admin.firstName || 'Admin';
    
    if (admin.isBlocked) {
      admin.blockedBy = req.user._id;
      admin.blockedAt = new Date();
      if (EmailService.sendAccountBlockedEmail) {
        await EmailService.sendAccountBlockedEmail(admin.email, displayName, reason);
      }
    } else {
      admin.blockedBy = undefined;
      admin.blockedAt = undefined;
      if (EmailService.sendAccountUnblockedEmail) {
        await EmailService.sendAccountUnblockedEmail(admin.email, displayName);
      }
    }
    
    await admin.save({ validateBeforeSave: false });
    
    res.json({ 
      success: true, 
      message: admin.isBlocked ? 'Admin blocked successfully' : 'Admin unblocked successfully', 
      admin 
    });
  } catch (error) {
    console.error('Toggle block admin error:', error);
    res.status(500).json({ error: 'Failed to toggle block status', details: error.message });
  }
};


exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (id === req.user._id.toString()) {
        return res.status(403).json({ error: 'You cannot delete yourself' });
    }

    const admin = await User.findOne({ _id: id, role: { $in: ['admin', 'super-admin'] }, deletedAt: null });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    admin.deletedAt = new Date();
    await admin.save({ validateBeforeSave: false });

    if (EmailService.sendAccountDeletedEmail) {
      await EmailService.sendAccountDeletedEmail(admin.email, admin.firstName || 'Admin');
    }
    
    res.json({ success: true, message: 'Admin deleted successfully', admin });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Failed to delete admin', details: error.message });
  }
};


exports.restoreAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const admin = await User.findOne({ _id: id, role: { $in: ['admin', 'super-admin'] } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    if (admin.deletedAt === null) {
        return res.json({ success: true, message: 'Admin is already active', admin });
    }
    
    admin.deletedAt = null;
    await admin.save({ validateBeforeSave: false });
    
    if (EmailService.sendAccountRestoredEmail) {
      await EmailService.sendAccountRestoredEmail(admin.email, admin.firstName || 'Admin');
    }

    res.json({ success: true, message: 'Admin restored successfully', admin });
  } catch (error) {
    console.error('Restore admin error:', error);
    res.status(500).json({ error: 'Failed to restore admin', details: error.message });
  }
};


exports.hardDeleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (id === req.user._id.toString()) {
        return res.status(403).json({ error: 'You cannot permanently delete yourself' });
    }

    const admin = await User.findOne({ _id: id, role: { $in: ['admin', 'super-admin'] }, deletedAt: { $ne: null } });
    
    if (!admin) {
      return res.status(404).json({ error: 'Trashed Admin not found' });
    }

    await User.findByIdAndDelete(id);

    res.json({ success: true, message: 'Admin permanently deleted' });
  } catch (error) {
    console.error('Hard delete admin error:', error);
    res.status(500).json({ error: 'Failed to permanently delete admin', details: error.message });
  }
};


exports.bulkDeleteAdmins = async (req, res) => {
  try {
    const { ids, action } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Please provide admin IDs to delete' });
    }

    const targetIds = ids.filter(id => id !== req.user._id.toString());
    if (targetIds.length === 0) {
        return res.status(403).json({ error: 'You cannot bulk delete yourself' });
    }

    if (action === 'hard') {
      await User.deleteMany({ _id: { $in: targetIds }, role: { $in: ['admin', 'super-admin'] }, deletedAt: { $ne: null } });
      return res.json({ success: true, message: `${targetIds.length} Admins permanently deleted` });
    } else {
      const now = new Date();
      await User.updateMany(
        { _id: { $in: targetIds }, role: { $in: ['admin', 'super-admin'] }, deletedAt: null },
        { $set: { deletedAt: now } }
      );
      return res.json({ success: true, message: `${targetIds.length} Admins moved to trash` });
    }
  } catch (error) {
    console.error('Bulk delete admins error:', error);
    res.status(500).json({ error: 'Failed to bulk delete admins', details: error.message });
  }
};
