const emailService = require('../services/email.service');

exports.sendQuote = async (req, res) => {
  try {
    const { name, email, projectDescription } = req.body;

    if (!name || !email || !projectDescription) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    await emailService.sendCustomQuoteRequest({ name, email, projectDescription });

    res.status(200).json({ message: 'Quote request sent successfully' });
  } catch (error) {
    console.error('Quote controller error:', error);
    res.status(500).json({ error: 'Failed to send quote request' });
  }
};
