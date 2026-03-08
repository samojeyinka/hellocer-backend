const { generateSecret, verify, generateURI } = require('otplib');
const qrcode = require('qrcode');
const User = require('../models/user.model');

// Generate 2FA Secret & QR Code
exports.generate2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate secret
    const secret = generateSecret();
    const otpauth = generateURI({
      issuer: 'Hellocer',
      label: user.email,
      secret
    });
    
    // Generate QR Code Data URL
    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    // Save secret temporarily.
    user.twoFactorSecret = secret;
    await user.save();

    res.json({
      success: true,
      qrCodeUrl,
      secret // Optional: Show secret for manual entry if QR scan fails
    });
  } catch (error) {
    console.error('2FA Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate 2FA setup' });
  }
};

// Verify the first code to enable 2FA
exports.verifySetup = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA setup not initiated' });
    }

    const result = await verify({
      token: code,
      secret: user.twoFactorSecret
    });

    if (!result || !result.valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    user.isTwoFactorEnabled = true;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Two-Factor Authentication has been enabled' 
    });
  } catch (error) {
    console.error('2FA Setup Verification Error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA setup' });
  }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.isTwoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Require valid code to disable
    const result = await verify({
      token: code,
      secret: user.twoFactorSecret
    });

    if (!result || !result.valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Two-Factor Authentication has been disabled' 
    });
  } catch (error) {
    console.error('2FA Disable Error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
};
