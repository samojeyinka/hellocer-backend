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
    const hellocians = await User.find({ role: 'hellocian' })
      .select('-password -refreshToken -passwordSetupToken -passwordSetupTokenExpires -resetPasswordToken')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: hellocians.length,
      hellocians
    });
  } catch (error) {
    console.error('Get hellocians error:', error);
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
