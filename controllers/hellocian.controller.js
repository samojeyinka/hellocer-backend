const crypto = require('crypto');
const User = require('../models/user.model');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');
const { generateUsername } = require('../utils/generateCode');
const EmailService = require('../services/email.service');

/**
 * @desc    Admin/Super-Admin creates a Hellocian account
 * @route   POST /api/hellocians/create
 * @access  Private (admin, super-admin)
 */
exports.createHellocian = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, bio, skills = [], keywords = [] } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        error: 'firstName, lastName, email, and phone are all required'
      });
    }

    // Check for duplicate email
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Check for duplicate phone
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ error: 'A Hellocian with this phone number already exists' });
    }

    // Generate a one-time password setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenExpires = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // Generate automatic username
    const username = generateUsername(firstName, lastName);

    // Create the hellocian — no password yet
    const hellocian = await User.create({
      firstName,
      lastName,
      username,
      email,
      phone,
      bio,
      skills,
      keywords,
      role: 'hellocian',
      isActivated: false,
      isProfileComplete: false,
      passwordSetupToken: setupToken,
      passwordSetupTokenExpires: setupTokenExpires
    });

    await EmailService.sendHellocianInvitation(email, firstName);

    res.status(201).json({
      success: true,
      message: 'Hellocian account created and invitation sent.',
      hellocian: {
        id: hellocian._id,
        firstName: hellocian.firstName,
        lastName: hellocian.lastName,
        email: hellocian.email,
        phone: hellocian.phone,
        bio: hellocian.bio,
        skills: hellocian.skills,
        keywords: hellocian.keywords,
        role: hellocian.role,
        isProfileComplete: hellocian.isProfileComplete,
        createdAt: hellocian.createdAt
      }
    });
  } catch (error) {
    console.error('Create Hellocian error:', error);
    res.status(500).json({ error: 'Failed to create Hellocian account', details: error.message });
  }
};

/**
 * @desc    Hellocian sets their password using the one-time setup token
 * @route   POST /api/hellocians/setup-password
 * @access  Public
 */
exports.setupPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }

    const passwordRegex = /^(?=(?:[^A-Z]*[A-Z]){3})(?=(?:[^a-z]*[a-z]){2})(?=(?:\D*\d){2})(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long, contain at least 3 uppercase letters, 2 lowercase letters, 2 digits, and 1 special character.' 
      });
    }

    // Find hellocian by valid, non-expired token
    const hellocian = await User.findOne({
      passwordSetupToken: token,
      passwordSetupTokenExpires: { $gt: Date.now() }
    });

    if (!hellocian) {
      return res.status(400).json({ error: 'Invalid or expired setup token' });
    }

    if (hellocian.isProfileComplete) {
      return res.status(400).json({ error: 'Password has already been set for this account' });
    }

    // Set password and activate account
    hellocian.password = password;
    hellocian.isActivated = true;
    hellocian.isProfileComplete = true;
    hellocian.passwordSetupToken = undefined;
    hellocian.passwordSetupTokenExpires = undefined;

    // Generate tokens so the Hellocian is logged in immediately after setup
    const accessToken = generateToken(hellocian._id);
    const refreshToken = generateRefreshToken(hellocian._id);
    hellocian.refreshToken = refreshToken;

    await hellocian.save();

    console.log(`✅  Hellocian ${hellocian.firstName} ${hellocian.lastName} has set their password and is now active.`);

    res.json({
      success: true,
      message: 'Password set successfully. You can now log in.',
      accessToken,
      refreshToken,
      user: {
        id: hellocian._id,
        firstName: hellocian.firstName,
        lastName: hellocian.lastName,
        phone: hellocian.phone,
        role: hellocian.role,
        isProfileComplete: hellocian.isProfileComplete
      }
    });
  } catch (error) {
    console.error('Setup password error:', error);
    res.status(500).json({ error: 'Failed to set password', details: error.message });
  }
};

/**
 * @desc    Get all Hellocian accounts
 * @route   GET /api/hellocians
 * @access  Private (admin, super-admin)
 */
exports.getHellocians = async (req, res) => {
  try {
    const hellocians = await User.find({ role: 'hellocian', deletedAt: null })
      .select('-password -refreshToken -passwordSetupToken -passwordSetupTokenExpires -resetPasswordToken')
      .sort({ createdAt: -1 });

    const Gig = require('../models/gig.model');

    const hellociansWithStats = await Promise.all(hellocians.map(async (h) => {
      // Find active and published gigs this hellocian is assigned to
      const gigQuery = {
        hellocians: h._id,
        isActive: true,
        status: 'published',
        deletedAt: null
      };
      
      const activeGigCount = await Gig.countDocuments(gigQuery);
      
      const gigs = await Gig.find(gigQuery).select('sales');
      const orderCount = gigs.reduce((sum, g) => sum + (g.sales || 0), 0);

      return {
        ...h.toObject(),
        activeGigCount,
        orderCount
      };
    }));

    res.json({
      success: true,
      count: hellocians.length,
      hellocians: hellociansWithStats
    });
  } catch (error) {
    console.error('Get hellocians error:', error);
    res.status(500).json({ error: 'Failed to fetch Hellocians', details: error.message });
  }
};

/**
 * @desc    Toggle block status of a Hellocian
 * @route   PATCH /api/hellocians/:id/toggle-block
 * @access  Private (admin, super-admin)
 */
exports.toggleBlockHellocian = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const hellocian = await User.findOne({ _id: id, role: 'hellocian', deletedAt: null });
    if (!hellocian) {
      return res.status(404).json({ error: 'Hellocian not found' });
    }
    
    hellocian.isBlocked = !hellocian.isBlocked;
    
    const displayName = hellocian.firstName || 'Hellocian';
    
    if (hellocian.isBlocked) {
      hellocian.blockedBy = req.user._id;
      hellocian.blockedAt = new Date();
      if (EmailService.sendAccountBlockedEmail) {
        await EmailService.sendAccountBlockedEmail(hellocian.email, displayName, reason);
      }
    } else {
      hellocian.blockedBy = undefined;
      hellocian.blockedAt = undefined;
      if (EmailService.sendAccountUnblockedEmail) {
        await EmailService.sendAccountUnblockedEmail(hellocian.email, displayName);
      }
    }
    
    await hellocian.save({ validateBeforeSave: false });
    
    res.json({ 
      success: true, 
      message: hellocian.isBlocked ? 'Hellocian blocked successfully' : 'Hellocian unblocked successfully', 
      hellocian 
    });
  } catch (error) {
    console.error('Toggle block hellocian error:', error);
    res.status(500).json({ error: 'Failed to toggle block status', details: error.message });
  }
};

/**
 * @desc    Soft delete a Hellocian
 * @route   DELETE /api/hellocians/:id
 * @access  Private (admin, super-admin)
 */
exports.deleteHellocian = async (req, res) => {
  try {
    const { id } = req.params;
    
    const hellocian = await User.findOne({ _id: id, role: 'hellocian', deletedAt: null });
    if (!hellocian) {
      return res.status(404).json({ error: 'Hellocian not found' });
    }
    
    hellocian.deletedAt = new Date();
    await hellocian.save({ validateBeforeSave: false });
    
    if (EmailService.sendAccountDeletedEmail) {
      await EmailService.sendAccountDeletedEmail(hellocian.email, hellocian.firstName || 'Hellocian');
    }
    
    res.json({ success: true, message: 'Hellocian deleted successfully' });
  } catch (error) {
    console.error('Delete hellocian error:', error);
    res.status(500).json({ error: 'Failed to delete Hellocian', details: error.message });
  }
};

/**
 * @desc    Get only activated Hellocians (for public /hire-talents)
 * @route   GET /api/hellocians/public
 * @access  Public
 */
exports.getPublicHellocians = async (req, res) => {
  try {
    const hellocians = await User.find({ role: 'hellocian', isActivated: true, deletedAt: null, isBlocked: false })
      .select('firstName lastName username profilePicture bio socials directMessages')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: hellocians.length,
      hellocians
    });
  } catch (error) {
    console.error('Get public hellocians error:', error);
    res.status(500).json({ error: 'Failed to fetch Hellocians', details: error.message });
  }
};

/**
 * @desc    Get only activated Hellocians (for gig assignment)
 * @route   GET /api/hellocians/active
 * @access  Private (admin, super-admin)
 */
exports.getActiveHellocians = async (req, res) => {
  try {
    const hellocians = await User.find({ role: 'hellocian', isActivated: true })
      .select('_id firstName lastName profilePicture bio')
      .sort({ firstName: 1 });

    res.json({
      success: true,
      count: hellocians.length,
      hellocians
    });
  } catch (error) {
    console.error('Get active hellocians error:', error);
    res.status(500).json({ error: 'Failed to fetch active Hellocians', details: error.message });
  }
};

/**
 * @desc    Get a single Hellocian by ID
 * @route   GET /api/hellocians/:id
 * @access  Private (admin, super-admin)
 */
exports.getHellocianById = async (req, res) => {
  try {
    const hellocian = await User.findOne({ _id: req.params.id, role: 'hellocian' })
      .select('-password -refreshToken -passwordSetupToken -passwordSetupTokenExpires -resetPasswordToken');

    if (!hellocian) {
      return res.status(404).json({ error: 'Hellocian not found' });
    }

    res.json({ success: true, hellocian });
  } catch (error) {
    console.error('Get hellocian error:', error);
    res.status(500).json({ error: 'Failed to fetch Hellocian', details: error.message });
  }
};

/**
 * @desc    Get all Trashed Hellocians
 * @route   GET /api/hellocians/trash
 * @access  Private (admin, super-admin)
 */
exports.getTrashedHellocians = async (req, res) => {
  try {
    const hellocians = await User.find({ role: 'hellocian', deletedAt: { $ne: null } })
      .select('-password -refreshToken')
      .sort({ deletedAt: -1 });

    res.json({
      success: true,
      count: hellocians.length,
      hellocians
    });
  } catch (error) {
    console.error('Get trashed hellocians error:', error);
    res.status(500).json({ error: 'Failed to fetch trashed Hellocians', details: error.message });
  }
};

/**
 * @desc    Restore a soft-deleted Hellocian
 * @route   PATCH /api/hellocians/:id/restore
 * @access  Private (admin, super-admin)
 */
exports.restoreHellocian = async (req, res) => {
  try {
    const { id } = req.params;
    
    const hellocian = await User.findOne({ _id: id, role: 'hellocian' });
    if (!hellocian) {
      return res.status(404).json({ error: 'Hellocian not found' });
    }
    
    // If it's already active, just return success.
    if (hellocian.deletedAt === null) {
        return res.json({ success: true, message: 'Hellocian is already active', hellocian });
    }
    
    hellocian.deletedAt = null;
    await hellocian.save({ validateBeforeSave: false });
    
    // Send email notification and await its completion
    if (EmailService.sendAccountRestoredEmail) {
      await EmailService.sendAccountRestoredEmail(hellocian.email, hellocian.firstName || 'Hellocian');
    }

    res.json({ success: true, message: 'Hellocian restored successfully', hellocian });
  } catch (error) {
    console.error('Restore hellocian error:', error);
    res.status(500).json({ error: 'Failed to restore Hellocian', details: error.message });
  }
};

/**
 * @desc    Permanently delete a Hellocian
 * @route   DELETE /api/hellocians/:id/hard
 * @access  Private (admin, super-admin)
 */
exports.hardDeleteHellocian = async (req, res) => {
  try {
    const { id } = req.params;
    
    const hellocian = await User.findOneAndDelete({ _id: id, role: 'hellocian' });
    if (!hellocian) {
      return res.status(404).json({ error: 'Hellocian not found' });
    }
    
    res.json({ success: true, message: 'Hellocian permanently deleted' });
  } catch (error) {
    console.error('Hard delete hellocian error:', error);
    res.status(500).json({ error: 'Failed to permanently delete Hellocian', details: error.message });
  }
};

/**
 * @desc    Bulk Delete Hellocians
 * @route   POST /api/hellocians/bulk-delete
 * @access  Private (admin, super-admin)
 */
exports.bulkDeleteHellocians = async (req, res) => {
  try {
    const { ids, action } = req.body; // action can be 'soft' or 'hard'
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of IDs' });
    }

    if (action === 'hard') {
      await User.deleteMany({ _id: { $in: ids }, role: 'hellocian' });
      return res.json({ success: true, message: `${ids.length} Hellocians permanently deleted` });
    } else {
      // Default to soft delete
      await User.updateMany(
        { _id: { $in: ids }, role: 'hellocian', deletedAt: null },
        { $set: { deletedAt: new Date() } }
      );
      
      // Optionally trigger emails here, or assume admin knows bulk delete is quiet
      return res.json({ success: true, message: `${ids.length} Hellocians soft-deleted successfully` });
    }
  } catch (error) {
    console.error('Bulk delete hellocians error:', error);
    res.status(500).json({ error: 'Failed to perform bulk delete', details: error.message });
  }
};
