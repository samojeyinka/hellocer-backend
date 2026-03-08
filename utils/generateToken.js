const jwt = require('jsonwebtoken');

exports.generateToken = (userId, expiresIn) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { 
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '7d'
  });
};

exports.generateRefreshToken = (userId, expiresIn) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: expiresIn || process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  });
};

exports.verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};