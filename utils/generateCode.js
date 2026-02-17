const crypto = require('crypto');

exports.generateActivationCode = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};