const crypto = require('crypto');

exports.generateActivationCode = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.generateSixAlphabetCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, letters.length);
    code += letters[randomIndex];
  }
  return code;
};

/**
 * Generate a username like "johndoe_x7k"
 * firstName + lastName (letters only) + underscore + 3 random alphanumeric chars
 */
exports.generateUsername = (firstName, lastName) => {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = crypto.randomBytes(3).toString('hex').slice(0, 3); // 3 hex chars
  return `${base}_${suffix}`;
};
