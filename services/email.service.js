const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

class EmailService {
  async sendAdminActivationCode(email, activationCode) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ADMIN EMAIL DRY RUN ---');
        console.log(`To: ${email}`);
        console.log(`Subject: Admin Account Activation`);
        console.log(`Code: ${activationCode}`);
        console.log('---------------------------');
        return { id: 'dry_run' };
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Admin Account Activation',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Activate Your Admin Account</h2>
            <p>You have been added as an admin. Please use the following 6-letter verification code to activate your account:</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <span style="font-size: 24px; letter-spacing: 5px; font-weight: bold; color: #174568;">${activationCode}</span>
            </div>
            <p>This code will expire in 24 hours.</p>
            <p>If you didn't expect this invitation, please ignore this email.</p>
          </div>
        `
      };

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send admin activation code:', error);
      throw error;
    }
  }

  async sendActivationEmail(email, firstName, activationCode) {
    try {
      const activationLink = `${process.env.FRONTEND_URL}/activate?code=${activationCode}`;
      
      if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_123') {
        console.log('--- EMAIL DRY RUN ---');
        console.log(`To: ${email}`);
        console.log(`Subject: Activate Your Account`);
        console.log(`Code: ${activationCode}`);
        console.log(`Link: ${activationLink}`);
        console.log('---------------------');
        return { id: 'dry_run' };
      }

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- EMAIL DRY RUN ---');
        console.log(`To: ${email}`);
        console.log(`Subject: Activate Your Account`);
        console.log(`Code: ${activationCode}`);
        console.log(`Link: ${activationLink}`);
        console.log('---------------------');
        return { id: 'dry_run' };
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Activate Your Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome ${firstName}!</h2>
            <p>Thank you for registering. Please activate your account by clicking the link below:</p>
            <a href="${activationLink}" 
               style="background-color: #4CAF50; color: white; padding: 14px 20px; 
                      text-decoration: none; display: inline-block; margin: 20px 0; 
                      border-radius: 4px;">
              Activate Account
            </a>
            <p>Or use this activation code: <strong>${activationCode}</strong></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Failed to send activation email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email, firstName) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Welcome to Our Platform!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Account Activated Successfully!</h2>
            <p>Hi ${firstName},</p>
            <p>Your account has been successfully activated. You can now log in and start exploring our services.</p>
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #4CAF50; color: white; padding: 14px 20px; 
                      text-decoration: none; display: inline-block; margin: 20px 0; 
                      border-radius: 4px;">
              Go to Login
            </a>
          </div>
        `
      };

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }

  async sendPasswordResetEmail(email, firstName, resetToken) {
    try {
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- EMAIL DRY RUN ---');
        console.log(`To: ${email}`);
        console.log(`Subject: Password Reset Request`);
        console.log(`Token: ${resetToken}`);
        console.log(`Link: ${resetLink}`);
        console.log('---------------------');
        return { id: 'dry_run' };
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hi ${firstName},</p>
            <p>You requested to reset your password. Click the link below to proceed:</p>
            <a href="${resetLink}" 
               style="background-color: #2196F3; color: white; padding: 14px 20px; 
                      text-decoration: none; display: inline-block; margin: 20px 0; 
                      border-radius: 4px;">
              Reset Password
            </a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `
      };

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw error;
    } 
  }

  async sendSettingsChangeOTP(email, firstName, otp) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- EMAIL DRY RUN ---');
        console.log(`To: ${email}`);
        console.log(`Subject: Account Settings Verification Code`);
        console.log(`OTP: ${otp}`);
        console.log('---------------------');
        return { id: 'dry_run' };
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Account Settings Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verification Code</h2>
            <p>Hi ${firstName},</p>
            <p>You requested to change secure settings on your account.</p>
            <p>Please enter the following 6-letter verification code to authorize this change:</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <span style="font-size: 24px; letter-spacing: 5px; font-weight: bold; color: #333;">${otp}</span>
            </div>
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this change, please change your password immediately and contact support.</p>
          </div>
        `
      };

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send verification OTP email:', error);
      throw error;
    }
  }

  async sendOrderNotification(email, firstName, orderDetails) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'orders@yourdomain.com',
        to: email,
        subject: 'Order Confirmation',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Order Confirmation</h2>
            <p>Hi ${firstName},</p>
            <p>Your order has been confirmed!</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderDetails.orderId}</p>
              <p style="margin: 5px 0;"><strong>Service:</strong> ${orderDetails.title}</p>
              <p style="margin: 5px 0;"><strong>Package:</strong> <span style="text-transform: capitalize;">${orderDetails.package}</span></p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> <span style="font-size: 20px; color: #4CAF50;">$${orderDetails.amount}</span></p>
            </div>
            <a href="${process.env.FRONTEND_URL}/orders/${orderDetails.orderId}" 
               style="background-color: #4CAF50; color: white; padding: 14px 20px; 
                      text-decoration: none; display: inline-block; margin: 20px 0; 
                      border-radius: 4px;">
              View Order Details
            </a>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              You can track your order status and communicate with the team through the order chat.
            </p>
          </div>
        `
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to send order notification:', error);
      // Don't throw - we don't want to fail order creation if email fails
    }
  }

  async sendAccountBlockedEmail(email, firstName, reason) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'security@yourdomain.com',
        to: email,
        subject: 'Account Blocked',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">Account Blocked</h2>
            <p>Hi ${firstName},</p>
            <p>Your account has been blocked.</p>
            ${reason ? `<div style="background-color: #ffebee; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
            </div>` : ''}
            <p>If you believe this is a mistake, please contact our support team.</p>
            <a href="${process.env.FRONTEND_URL}/contact" 
               style="background-color: #2196F3; color: white; padding: 14px 20px; 
                      text-decoration: none; display: inline-block; margin: 20px 0; 
                      border-radius: 4px;">
              Contact Support
            </a>
          </div>
        `
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to send account blocked email:', error);
    }
  }

  async sendAdminInvitation(email) {
    try {
      const activationLink = `${process.env.FRONTEND_URL}/admins/activate`;
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ADMIN INVITATION DRY RUN ---');
        console.log(`To: ${email}`);
        console.log(`Subject: Admin Invitation`);
        console.log(`Link: ${activationLink}`);
        console.log('-------------------------------');
        return { id: 'dry_run' };
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'You have been invited as an Admin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello!</h2>
            <p>You have been added as an admin on Hellocer. Please activate your account by clicking the link below:</p>
            <a href="${activationLink}" 
               style="background-color: #174568; color: white; padding: 14px 20px; 
                      text-decoration: none; display: inline-block; margin: 20px 0; 
                      border-radius: 4px;">
              Activate Admin Account
            </a>
            <p>If you didn't expect this, please ignore this email.</p>
          </div>
        `
      };

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send admin invitation email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();