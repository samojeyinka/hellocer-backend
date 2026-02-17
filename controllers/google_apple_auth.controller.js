const User = require('../models/user.model');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');

exports.googleAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, profilePicture } = req.body;

    let user = await User.findOne({ email });

    if (user) {
      // User exists - login
      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      user.refreshToken = refreshToken;
      await user.save();

      return res.json({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture
        }
      });
    } else {
      // User doesn't exist - register (no activation needed)
      const newUser = await User.create({
        firstName,
        lastName,
        email,
        password: Math.random().toString(36).slice(-16), // Random password
        profilePicture,
        isActivated: true, // Auto-activate for social auth
        role: 'user'
      });

      const accessToken = generateToken(newUser._id);
      const refreshToken = generateRefreshToken(newUser._id);

      newUser.refreshToken = refreshToken;
      await newUser.save();

      return res.status(201).json({
        success: true,
        message: 'Account created and logged in successfully',
        accessToken,
        refreshToken,
        user: {
          id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
          profilePicture: newUser.profilePicture
        }
      });
    }
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed', details: error.message });
  }
};

exports.appleAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, profilePicture } = req.body;

    let user = await User.findOne({ email });

    if (user) {
      // User exists - login
      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      user.refreshToken = refreshToken;
      await user.save();

      return res.json({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture
        }
      });
    } else {
      // User doesn't exist - register (no activation needed)
      const newUser = await User.create({
        firstName,
        lastName,
        email,
        password: Math.random().toString(36).slice(-16), // Random password
        profilePicture,
        isActivated: true, // Auto-activate for social auth
        role: 'user'
      });

      const accessToken = generateToken(newUser._id);
      const refreshToken = generateRefreshToken(newUser._id);

      newUser.refreshToken = refreshToken;
      await newUser.save();

      return res.status(201).json({
        success: true,
        message: 'Account created and logged in successfully',
        accessToken,
        refreshToken,
        user: {
          id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
          profilePicture: newUser.profilePicture
        }
      });
    }
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ error: 'Apple authentication failed', details: error.message });
  }
};


// Add this function to your auth controller

exports.twitterAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, profilePicture } = req.body;

    let user = await User.findOne({ email });

    if (user) {
      // User exists - login
      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      user.refreshToken = refreshToken;
      await user.save();

      return res.json({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture
        }
      });
    } else {
      // User doesn't exist - register (no activation needed)
      const newUser = await User.create({
        firstName,
        lastName,
        email,
        password: Math.random().toString(36).slice(-16),
        profilePicture,
        isActivated: true,
        role: 'user'
      });

      const accessToken = generateToken(newUser._id);
      const refreshToken = generateRefreshToken(newUser._id);

      newUser.refreshToken = refreshToken;
      await newUser.save();

      return res.status(201).json({
        success: true,
        message: 'Account created and logged in successfully',
        accessToken,
        refreshToken,
        user: {
          id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
          profilePicture: newUser.profilePicture
        }
      });
    }
  } catch (error) {
    console.error('Twitter auth error:', error);
    res.status(500).json({ error: 'Twitter authentication failed', details: error.message });
  }
};