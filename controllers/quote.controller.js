const Quote = require('../models/quote.model');
const User = require('../models/user.model');
const emailService = require('../services/email.service');

exports.sendQuote = async (req, res) => {
  try {
    const { fullName, email, projectName, projectDescription, skills, files } = req.body;

    if (!fullName || !email || !projectName || !projectDescription) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    const newQuote = new Quote({
      fullName,
      email,
      projectName,
      projectDescription,
      skills,
      files
    });

    await newQuote.save();

    // Fetch all super-admins who are activated and not blocked
    const superAdmins = await User.find({
      role: 'super-admin',
      isActivated: true,
      isBlocked: false
    });

    // Notify each super-admin
    const notificationPromises = superAdmins.map(admin => 
      emailService.sendQuoteNotificationToAdmin(admin.email, {
        name: fullName,
        email,
        projectName,
        projectDescription,
        skills
      })
    );

    await Promise.all(notificationPromises);

    res.status(200).json({ message: 'Project request submitted successfully' });
  } catch (error) {
    console.error('Quote submission error:', error);
    res.status(500).json({ error: 'Failed to submit project request' });
  }
};

exports.getQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find().sort({ createdAt: -1 });
    res.status(200).json(quotes);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch project requests' });
  }
};

exports.replyToQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { replyContent } = req.body;
    const adminId = req.user.id;

    if (!replyContent) {
      return res.status(400).json({ error: 'Reply content is required' });
    }

    const quote = await Quote.findById(quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Project request not found' });
    }

    if (quote.status === 'replied') {
      return res.status(400).json({ error: 'This request has already been replied to' });
    }

    const admin = await User.findById(adminId);
    
    quote.status = 'replied';
    quote.replyContent = replyContent;
    quote.repliedBy = adminId;
    quote.repliedAt = new Date();

    await quote.save();

    // Send email to submitter
    await emailService.sendQuoteReplyToSubmitter(quote.email, {
      submitterName: quote.fullName,
      projectName: quote.projectName,
      replyContent,
      adminName: `${admin.firstName} ${admin.lastName}`
    });

    res.status(200).json({ message: 'Reply sent successfully', quote });
  } catch (error) {
    console.error('Error replying to quote:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
};
