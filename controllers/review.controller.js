const Review = require('../models/review.model');
const Order = require('../models/order.model');
const Gig = require('../models/gig.model');
const NotificationService = require('../services/notification.service');
const EmailService = require('../services/email.service');
const User = require('../models/user.model');

exports.createReview = async (req, res) => {
  try {
    const { orderId, gigId, rating, comment, deliverySpeed } = req.body;
    const userId = req.user._id;

    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Use order.gigId if gigId is missing from request body
    const finalGigId = gigId || order.gigId;
    if (!finalGigId) {
      return res.status(400).json({ error: 'Gig ID is required' });
    }

    if (order.clientId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to review this order' });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review completed orders' });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({ orderId, userId });
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this order' });
    }

    const review = await Review.create({
      orderId,
      gigId: finalGigId,
      userId,
      rating,
      comment,
      deliverySpeed
    });

    // Update gig ratings
    const gig = await Gig.findById(finalGigId);
    gig.totalStars += rating;
    gig.starNumber += 1;
    await gig.save();

    // Mark order as reviewed
    order.isReviewed = true;
    await order.save();

    // Notify team about new review
    const teamNotifications = [
      {
        userId: order.gigCreatorId,
        type: 'review_received',
        title: 'New Review Received',
        message: `You received a ${rating}-star review for "${order.title}".`,
        relatedId: review._id,
        relatedModel: 'Review'
      },
      ...order.hellocians.map(hId => ({
        userId: hId,
        type: 'review_received',
        title: 'New Review Received',
        message: `Your team received a ${rating}-star review for "${order.title}".`,
        relatedId: review._id,
        relatedModel: 'Review'
      }))
    ];

    await NotificationService.createBulkNotifications(teamNotifications);

    // Send Emails to Gig Creator and Hellocians
    const participants = await User.find({ 
      _id: { $in: [order.gigCreatorId, ...order.hellocians] } 
    });

    const reviewer = await User.findById(userId);

    for (const participant of participants) {
      if (participant.email) {
        await EmailService.sendReviewReceivedEmail(
          participant.email,
          participant.firstName,
          {
            orderTitle: order.title,
            rating,
            comment,
            reviewerName: `${reviewer.firstName} ${reviewer.lastName}`
          }
        );
      }
    }

    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
};

exports.getGigReviews = async (req, res) => {
  try {
    const { gigId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ gigId })
      .populate('userId', 'firstName lastName profilePicture')
      .populate('response.respondedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ gigId });

    res.json({
      success: true,
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
};

exports.respondToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { comment } = req.body;

    const review = await Review.findById(reviewId).populate('gigId');
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user can respond (gig creator, hellocian, or admin)
    const gig = await Gig.findById(review.gigId);
    const canRespond = 
      gig.creator.toString() === req.user._id.toString() ||
      gig.hellocians.some(h => h.toString() === req.user._id.toString()) ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!canRespond) {
      return res.status(403).json({ error: 'Not authorized to respond to this review' });
    }

    review.response = {
      comment,
      respondedBy: req.user._id,
      respondedAt: new Date()
    };
    await review.save();

    res.json({ success: true, review });
  } catch (error) {
    console.error('Respond to review error:', error);
    res.status(500).json({ error: 'Failed to respond to review' });
  }
};

exports.updateReview = async (req, res) => {
  return res.status(403).json({ error: 'Reviews cannot be edited once submitted' });
};

exports.deleteReview = async (req, res) => {
  return res.status(403).json({ error: 'Reviews cannot be deleted once submitted' });
};