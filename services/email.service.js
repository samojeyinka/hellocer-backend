const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

class EmailService {
  async sendMessageNotification(email, firstName, messageData) {
    try {
      const { senderName, content, chatLink } = messageData;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `New Message from ${senderName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">You have a new message</h2>
            <p>Hi ${firstName},</p>
            <p><strong>${senderName}</strong> sent you a message:</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #174568;">
              <p style="margin: 0; color: #333;">${content}</p>
            </div>
            
            <a href="${chatLink}" 
               style="background-color: #174568; color: white; padding: 12px 20px;
                      text-decoration: none; display: inline-block; margin: 10px 0; border-radius: 4px;">
              Reply in Chat
            </a>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- MESSAGE EMAIL DRY RUN ---', { to: email, senderName });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send message notification email:', error);
    }
  }
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

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send activation email:', error);
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
      const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      
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
      const isClient = !!orderDetails.isClient;
      const subject = isClient
        ? `Order Confirmed: ${orderDetails.title}`
        : `New Order Received: ${orderDetails.title}`;

      const heading = isClient ? 'Your Order is Confirmed!' : 'You Have a New Order!';
      const introParagraph = isClient
        ? `Hi ${firstName}, your payment was successful and your order has been created.`
        : `Hi ${firstName}, a new order has been placed for one of your gigs.`;

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #174568;">${heading}</h2>
            <p>${introParagraph}</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderDetails.orderId}</p>
              <p style="margin: 5px 0;"><strong>Service:</strong> ${orderDetails.title}</p>
              <p style="margin: 5px 0;"><strong>Package:</strong> <span style="text-transform: capitalize;">${orderDetails.package}</span></p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> <span style="font-size: 18px; color: #4CAF50;">$${orderDetails.amount}</span></p>
            </div>
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background-color: #174568; color: white; padding: 12px 20px;
                      text-decoration: none; display: inline-block; margin: 10px 0; border-radius: 4px;">
              View Dashboard
            </a>
            <p style="color: #666; font-size: 13px; margin-top: 20px;">
              You can track the order and communicate with the team through your dashboard.
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ORDER EMAIL DRY RUN ---', { to: email, subject });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send order notification email:', error);
      // Don't throw — we don't want to fail order creation if email fails
    }
  }

  async sendAccountBlockedEmail(email, firstName, reason) {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Account Suspended',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">Account Suspended</h2>
            <p>Hi ${firstName},</p>
            <p>Your account has been temporarily suspended.</p>
            ${reason ? `<div style="background-color: #ffebee; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
            </div>` : ''}
            <p>If you believe this is a mistake, please contact our support team.</p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- EMAIL DRY RUN ---', mailOptions);
        return { id: 'dry_run' };
      }

      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Failed to send account blocked email:', error);
    }
  }

  async sendAccountUnblockedEmail(email, firstName) {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Account Restored',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Account Unblocked</h2>
            <p>Hi ${firstName},</p>
            <p>Your account access has been completely restored. You can now log back in and continue using our platform.</p>
            <p>Welcome back!</p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- EMAIL DRY RUN ---', mailOptions);
        return { id: 'dry_run' };
      }

      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Failed to send account unblocked email:', error);
    }
  }

  async sendAccountRestoredEmail(email, firstName) {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Account Restored',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Account Restored</h2>
            <p>Hi ${firstName},</p>
            <p>Your account has been restored from the trash. You can now log back in and continue using our platform.</p>
            <p>Welcome back!</p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- EMAIL DRY RUN ---', mailOptions);
        return { id: 'dry_run' };
      }

      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Failed to send account restored email:', error);
    }
  }

  async sendAccountDeletedEmail(email, firstName) {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Account Deleted',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">Account Deleted</h2>
            <p>Hi ${firstName},</p>
            <p>Your account on our platform has been deleted by an administrator.</p>
            <p>All of your relevant standing access has been immediately revoked. If you believe this action was done in error or you have unresolved business, please contact our support team.</p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- EMAIL DRY RUN ---', mailOptions);
        return { id: 'dry_run' };
      }

      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Failed to send account deleted email:', error);
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

  async sendHellocianInvitation(email, firstName) {
    try {
      const setupLink = `${process.env.FRONTEND_URL}/hellocians/setup-password`; // I'll need to check if this page exists or create it
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- HELLOCIAN INVITATION DRY RUN ---');
        console.log(`To: ${email}`);
        console.log(`Subject: Hellocian Invitation`);
        console.log(`Link: ${setupLink}`);
        console.log('------------------------------------');
        return { id: 'dry_run' };
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `Hello ${firstName}, You have been invited as a Hellocian`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #174568;">Welcome to Hellocer!</h2>
            <p>Hi ${firstName},</p>
            <p>You have been added as a Hellocian on our platform. To get started, please set up your account password by clicking the link below:</p>
            <a href="${setupLink}" 
               style="background-color: #174568; color: white; padding: 14px 20px; 
                      text-decoration: none; display: inline-block; margin: 20px 0; 
                      border-radius: 4px;">
              Set Up Account
            </a>
            <p>This invitation allows you to join our network of professionals and start working on exciting projects.</p>
            <p>If you have any questions, feel free to reply to this email.</p>
            <p>Best regards,<br>The Hellocer Team</p>
          </div>
        `
      };

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send hellocian invitation email:', error);
      throw error;
    }
  }

  async sendQuoteNotificationToAdmin(adminEmail, data) {
    try {
      const { name, email, projectName, projectDescription, skills } = data;
      const dashboardLink = `${process.env.FRONTEND_URL}/admins/project-requests`;

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: adminEmail,
        replyTo: email,
        subject: `[New Project Request] ${projectName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #174568;">New Project Quote Request</h2>
            <p><strong>Submitter:</strong> ${name} (${email})</p>
            <p><strong>Project Name:</strong> ${projectName}</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Description:</strong></p>
              <p style="white-space: pre-wrap;">${projectDescription}</p>
              ${skills && skills.length > 0 ? `<p><strong>Skills:</strong> ${skills.join(', ')}</p>` : ''}
            </div>
            <a href="${dashboardLink}" 
               style="background-color: #174568; color: white; padding: 12px 20px;
                      text-decoration: none; display: inline-block; margin: 10px 0; border-radius: 4px;">
              View in Dashboard
            </a>
            <p style="color: #666; font-size: 11px; margin-top: 20px;">This is an automated notification from Hellocer.</p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ADMIN QUOTE NOTIFICATION DRY RUN ---', { to: adminEmail });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send admin quote notification:', error);
    }
  }

  async sendQuoteReplyToSubmitter(submitterEmail, data) {
    try {
      const { submitterName, projectName, replyContent, adminName } = data;

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: submitterEmail,
        subject: `Response to your project request: ${projectName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">Hello ${submitterName},</h2>
            <p>Thank you for submitting your project request for <strong>"${projectName}"</strong>. We have reviewed your brief and have the following response:</p>
            
            <div style="border-left: 4px solid #174568; padding: 15px 20px; margin: 25px 0; background-color: #f8fbff; font-style: italic; font-size: 16px; line-height: 1.6; color: #333;">
              ${replyContent.replace(/\n/g, '<br/>')}
            </div>
            
            <p>If you have any further questions or would like to proceed, please reply directly to this email.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br/>
              ${adminName}<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- QUOTE REPLY DRY RUN ---', { to: submitterEmail });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send quote reply email:', error);
      throw error;
    }
  }

  async sendOrderExtensionEmail(email, firstName, orderDetails) {
    try {
      const { orderId, title, oldDate, newDate, reason } = orderDetails;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `Order Delivery Extended: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">Delivery Date Extended</h2>
            <p>Hi ${firstName},</p>
            <p>The delivery date for order <strong>"${title}"</strong> has been extended.</p>
            
            <div style="background-color: #f8fbff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e1efff;">
              <p style="margin: 5px 0;"><strong>Order ID:</strong> #${orderId.substring(orderId.length - 6).toUpperCase()}</p>
              <p style="margin: 5px 0; color: #666; text-decoration: line-through;"><strong>Original Date:</strong> ${new Date(oldDate).toLocaleDateString()}</p>
              <p style="margin: 5px 0; color: #174568; font-size: 18px;"><strong>New Delivery Date:</strong> ${new Date(newDate).toLocaleDateString()}</p>
              ${reason ? `<p style="margin: 15px 0 0 0; font-style: italic;"><strong>Reason:</strong> ${reason}</p>` : ''}
            </div>
            
            <p>You can track the progress and communicate with the team via your dashboard.</p>
            
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background-color: #174568; color: white; padding: 12px 20px;
                      text-decoration: none; display: inline-block; margin: 10px 0; border-radius: 4px;">
              View Dashboard
            </a>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ORDER EXTENSION EMAIL DRY RUN ---', { to: email });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send order extension email:', error);
    }
  }

  async sendOrderAssignmentEmail(email, firstName, orderDetails) {
    try {
      const { orderId, title } = orderDetails;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `New Project Assignment: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">Project Assigned</h2>
            <p>Hi ${firstName},</p>
            <p>You have been assigned to work on order: <strong>"${title}"</strong>.</p>
            
            <div style="background-color: #f8fbff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e1efff;">
              <p style="margin: 5px 0;"><strong>Order ID:</strong> #${orderId.substring(orderId.length - 6).toUpperCase()}</p>
              <p style="margin: 5px 0;"><strong>Project:</strong> ${title}</p>
            </div>
            
            <p>You can now view project details and participate in the group chat via your dashboard.</p>
            
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background-color: #174568; color: white; padding: 12px 20px;
                      text-decoration: none; display: inline-block; margin: 10px 0; border-radius: 4px;">
              Go to Dashboard
            </a>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ORDER ASSIGNMENT EMAIL DRY RUN ---', { to: email });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send order assignment email:', error);
    }
  }

  async sendOrderRemovalEmail(email, firstName, orderDetails) {
    try {
      const { orderId, title } = orderDetails;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `Project Assignment Update: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #666;">Project Update</h2>
            <p>Hi ${firstName},</p>
            <p>You have been removed from the order: <strong>"${title}"</strong>.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Order ID:</strong> #${orderId.substring(orderId.length - 6).toUpperCase()}</p>
              <p style="margin: 5px 0;"><strong>Project:</strong> ${title}</p>
            </div>
            
            <p>If you have any questions regarding this change, please reach out to the project administrator.</p>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ORDER REMOVAL EMAIL DRY RUN ---', { to: email });
        return { id: 'dry_run' };
      }

      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Failed to send order removal email:', error);
    }
  }

  async sendCallInvitation(email, firstName, callData) {
    try {
      const { callerName, roomID, callType } = callData;
      const joinLink = `${process.env.FRONTEND_URL}/call/${roomID}?type=${callType}`;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `Incoming ${callType} Call from ${callerName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px; text-align: center;">
            <h2 style="color: #174568;">${callType.charAt(0).toUpperCase() + callType.slice(1)} Call Invitation</h2>
            <p style="font-size: 16px;">${callerName} is inviting you to a ${callType} call.</p>
            
            <div style="margin: 30px 0;">
              <a href="${joinLink}" 
                 style="background-color: #0077B6; color: white; padding: 15px 30px; 
                        text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; font-size: 18px;">
                Join Call Now
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">If you can't click the button, copy and paste this link into your browser:</p>
            <p style="color: #0077B6; font-size: 12px; word-break: break-all;">${joinLink}</p>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- CALL INVITATION DRY RUN ---', { to: email, joinLink });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send call invitation email:', error);
    }
  }

  async sendReviewPromptEmail(email, firstName, orderDetails) {
    try {
      const { orderId, title } = orderDetails;
      const reviewLink = `${process.env.FRONTEND_URL}/clients/projects`;

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `How was your experience? Review your order: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">Your Order is Complete!</h2>
            <p>Hi ${firstName},</p>
            <p>Great news! Your order <strong>"${title}"</strong> has been marked as completed.</p>
            <p>We'd love to hear about your experience. Your feedback helps us improve and helps other clients find the best services.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" 
                 style="background-color: #ffc107; color: #000; padding: 14px 25px; 
                        text-decoration: none; display: inline-block; border-radius: 4px; font-weight: bold;">
                Leave a Review
              </a>
            </div>
            
            <p style="font-size: 13px; color: #666;">
              Order ID: #${orderId.substring(orderId.length - 6).toUpperCase()}
            </p>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- REVIEW PROMPT EMAIL DRY RUN ---', { to: email });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send review prompt email:', error);
    }
  }

  async sendReviewReminderEmail(email, firstName, orderDetails) {
    try {
      const { orderId, title } = orderDetails;
      const reviewLink = `${process.env.FRONTEND_URL}/clients/projects`;

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `Friendly Reminder: Review your order for ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">We'd Love Your Feedback</h2>
            <p>Hi ${firstName},</p>
            <p>This is a friendly reminder to leave a review for your recent project <strong>"${title}"</strong>.</p>
            <p>It only takes a minute and really helps the team!</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" 
                 style="background-color: #ffc107; color: #000; padding: 14px 25px; 
                        text-decoration: none; display: inline-block; border-radius: 4px; font-weight: bold;">
                Write a Review
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Thank you,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- REVIEW REMINDER EMAIL DRY RUN ---', { 
            to: email, 
            orderId: orderId,
            frontendUrl: process.env.FRONTEND_URL 
        });
        return { id: 'dry_run' };
      }

      console.log(`Sending review reminder to ${email}...`);
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return info;
    } catch (error) {
      console.error('Failed to send review reminder email:', error);
      throw error; // Throw so controller can catch it
    }
  }

  async sendReviewReceivedEmail(email, firstName, reviewData) {
    try {
      const { orderTitle, rating, comment, reviewerName } = reviewData;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `New ${rating}-Star Review for ${orderTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">New Review Received</h2>
            <p>Hi ${firstName},</p>
            <p>You have received a new review from <strong>${reviewerName}</strong> for the project: <strong>"${orderTitle}"</strong>.</p>
            
            <div style="background-color: #f8fbff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e1efff;">
              <p style="margin: 0 0 10px 0;"><strong>Rating:</strong> ${rating} / 5 Stars</p>
              <p style="margin: 0; font-style: italic;">"${comment}"</p>
            </div>
            
            <p>You can view this review and respond to it via your gig details page.</p>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- REVIEW RECEIVED EMAIL DRY RUN ---', { to: email, rating });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send review received email:', error);
    }
  }
  async sendAdditionalPaymentSuccessEmail(email, firstName, data) {
    try {
      const { orderId, title, amount } = data;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `Payment Receipt: Additional Payment for "${title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">Payment Successful</h2>
            <p>Hi ${firstName},</p>
            <p>Your additional payment for the project <strong>"${title}"</strong> has been successfully processed.</p>
            
            <div style="background-color: #f8fbff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e1efff;">
              <p style="margin: 0 0 10px 0;"><strong>Amount Paid:</strong> $${amount}</p>
              <p style="margin: 0;"><strong>Order ID:</strong> #${orderId.substring(orderId.length - 6).toUpperCase()}</p>
            </div>
            
            <p>Thank you for your prompt payment.</p>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ADDITIONAL PAYMENT SUCCESS EMAIL DRY RUN ---', { to: email, title, amount });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send additional payment success email:', error);
    }
  }

  async sendAdditionalPaymentTeamNotification(email, firstName, data) {
    try {
      const { orderId, title, amount } = data;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `New Payment Received: Additional Payment for "${title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">New Payment Received</h2>
            <p>Hi ${firstName},</p>
            <p>The client has successfully completed the requested additional payment for the project <strong>"${title}"</strong>.</p>
            
            <div style="background-color: #f8fbff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e1efff;">
              <p style="margin: 0 0 10px 0;"><strong>Amount Paid:</strong> $${amount}</p>
              <p style="margin: 0;"><strong>Order ID:</strong> #${orderId.substring(orderId.length - 6).toUpperCase()}</p>
            </div>
            
            <p>The project flow can now proceed as discussed.</p>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ADDITIONAL PAYMENT TEAM NOTIFICATION DRY RUN ---', { to: email, title, amount });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send additional payment team notification email:', error);
    }
  }

  async sendAdditionalPaymentRequestEmail(email, firstName, data) {
    try {
      const { orderId, title, amount, description, paymentIndex } = data;
      const paymentLink = `${process.env.FRONTEND_URL}/payment/order/${orderId}/${paymentIndex}`;

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: `Payment Request: Action Required for Order "${title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">Additional Payment Requested</h2>
            <p>Hi ${firstName},</p>
            <p>An additional payment has been requested for your project <strong>"${title}"</strong>.</p>
            
            <div style="background-color: #f8fbff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e1efff;">
              <p style="margin: 0 0 10px 0;"><strong>Amount Due:</strong> $${amount}</p>
              <p style="margin: 0;"><strong>Reason:</strong> ${description}</p>
            </div>
            
            <p>Please click the button below to complete this payment:</p>
            
            <a href="${paymentLink}" 
               style="background-color: #174568; color: white; padding: 14px 25px; 
                      text-decoration: none; display: inline-block; border-radius: 4px; font-weight: bold; margin: 20px 0;">
              Pay Now
            </a>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              If you have any questions, you can discuss this with the team via your project chat.<br/><br/>
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- ADDITIONAL PAYMENT EMAIL DRY RUN ---', { to: email, amount });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send additional payment request email:', error);
    }
  }

  async sendContactFormNotification(adminEmail, adminName, contactData) {
    try {
      const { fullName, email, message } = contactData;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: adminEmail,
        replyTo: email,
        subject: `[Contact Us] New message from ${fullName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h2 style="color: #174568;">New Contact Us Submission</h2>
            <p>Hi ${adminName},</p>
            <p>You have received a new message from the contact form:</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #174568;">
              <p style="margin: 0; color: #333;"><strong>From:</strong> ${fullName} (${email})</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 10px 0;">
              <p style="margin: 0; color: #333; white-space: pre-wrap;">${message}</p>
            </div>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888;">
              Best regards,<br/>
              The Hellocer Team
            </p>
          </div>
        `
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- CONTACT FORM EMAIL DRY RUN ---', { to: adminEmail, from: email });
        return { id: 'dry_run' };
      }

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send contact form notification email:', error);
    }
  }
}

module.exports = new EmailService();