const otplib = require('otplib');
console.log('Otplib Keys:', Object.keys(otplib));
console.log('Authenticator keys:', otplib.authenticator ? Object.keys(otplib.authenticator) : 'undefined');
