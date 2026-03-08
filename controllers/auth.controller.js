const User = require('../models/user.model');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/generateToken');
const { verify } = require('otplib');
const { generateActivationCode, generateResetToken, generateUsername } = require('../utils/generateCode');
const EmailService = require('../services/email.service');
const crypto = require('crypto');
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, agreeToTerms, role = 'user' } = req.body;

     if(!agreeToTerms){
      return res.status(400).json({ error: 'Please agree to the terms and conditions' });
    }

    const passwordRegex = /^(?=(?:[^A-Z]*[A-Z]){3})(?=(?:[^a-z]*[a-z]){2})(?=(?:\D*\d){2})(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long, contain at least 3 uppercase letters, 2 lowercase letters, 2 digits, and 1 special character.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const activationCode = generateActivationCode();
    const activationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const username = generateUsername(firstName, lastName);
    const hashedActivationCode = crypto.createHash('sha256').update(activationCode).digest('hex');



    const user = await User.create({
      firstName,
      lastName,
      username,
      email,
      password,
      role,
      activationCode: hashedActivationCode,
      activationCodeExpires,
      isActivated: false
    });

    // await console.log(email, firstName, activationCode);


    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to activate your account.',
      email: user.email,
      activationCode: activationCode,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
};

exports.activateAccount = async (req, res) => {
  try {
    const { code } = req.body;

    const user = await User.findOne({
      activationCode: code,
      activationCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired activation code' });
    }

    user.isActivated = true;
    user.activationCode = undefined;
    user.activationCodeExpires = undefined;
    await user.save();

    // await EmailService.sendWelcomeEmail(user.email, user.firstName);

    res.json({
      success: true,
      message: 'Account activated successfully. Please log in.'
    });
  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ error: 'Activation failed', details: error.message });
  }
};

exports.resendActivationCode = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isActivated) {
      return res.status(400).json({ error: 'Account already activated' });
    }

    const activationCode = generateActivationCode();
    const activationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const hashedActivationCode = crypto.createHash('sha256').update(activationCode).digest('hex');

    user.activationCode = hashedActivationCode;
    user.activationCodeExpires = activationCodeExpires;
    await user.save();

    // await EmailService.sendActivationEmail(email, user.firstName, activationCode);

    console.log(hashedActivationCode);
    
    res.json({
      success: true,
      message: 'Activation code resent successfully',
      activationCode: hashedActivationCode
    });
  } catch (error) {
    console.error('Resend activation error:', error);
    res.status(500).json({ error: 'Failed to resend activation code' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActivated) {
      return res.status(403).json({
        error: 'Please activate your account first',
        activationRequired: true,
        email: user.email
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked' });
    } 

    // Set custom expirations if rememberMe is true
    const expiresIn = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN || '1d'; 
    const refreshExpiresIn = rememberMe ? '60d' : process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    // Check if 2FA is enabled
    if (user.isTwoFactorEnabled) {
      return res.json({
        success: true,
        requires2FA: true,
        email: user.email
      });
    }

    // Generate both tokens
    const accessToken = generateToken(user._id, expiresIn);
    const refreshToken = generateRefreshToken(user._id, refreshExpiresIn);

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user:user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
};

exports.verify2FALogin = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.isTwoFactorEnabled) {
      return res.status(400).json({ error: '2FA not enabled for this account' });
    }

    const result = await verify({
      token: code,
      secret: user.twoFactorSecret
    });
    if (!result || !result.valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate full tokens
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    const accessToken = generateToken(user._id, expiresIn);
    const refreshToken = generateRefreshToken(user._id, refreshExpiresIn);

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: user
    });
  } catch (error) {
    console.error('2FA Login Verification Error:', error);
    res.status(500).json({ error: 'Login verification failed' });
  }
};

exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newAccessToken = generateToken(user._id);

    res.json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Failed to refresh access token' });
  }
};

exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.refreshToken = null;
    await user.save();

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = generateResetToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    // await EmailService.sendPasswordResetEmail(email, user.firstName, resetToken);

    res.json({
      success: true,
      message: 'Password reset link sent to your email',
      resetToken: resetToken
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user data' });
  }
};