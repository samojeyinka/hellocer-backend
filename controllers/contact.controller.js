const User = require('../models/user.model');
const emailService = require('../services/email.service');


const submitContactForm = async (req, res) => {
  try {
    const { fullName, email, message } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    // Find all admins and super-admins
    const admins = await User.find({
      role: { $in: ['admin', 'super-admin'] }
    });

    if (admins.length > 0) {
      // Send email to each admin
      const emailPromises = admins.map(admin => {
        const mailOptions = {
          from: process.env.FROM_EMAIL || process.env.SMTP_USER,
          to: admin.email,
          subject: `[Contact Us] New message from ${fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
              <h2 style="color: #174568;">New Contact Us Submission</h2>
              <p><strong>From:</strong> ${fullName} (${email})</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #174568;">
                <p style="margin: 0; color: #333; white-space: pre-wrap;">${message}</p>
              </div>
              <p style="margin-top: 30px; font-size: 13px; color: #888;">
                This is an automated notification from Hellocer Contact System.
              </p>
            </div>
          `
        };
     
        return emailService.sendContactFormNotification(admin.email, admin.firstName, { fullName, email, message });
      });

      // Send email to each admin (non-blocking)
      Promise.all(emailPromises).catch(err => console.error('Error sending contact emails:', err));
    }

    res.status(200).json({ message: 'Your message has been sent successfully. We will get back to you soon.' });
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
};

module.exports = {
  submitContactForm
};
