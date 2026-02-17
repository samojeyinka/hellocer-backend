const Review = require('../models/review.model');

exports.createReview = async (req, res) => {
  try {
    const { orderId, gigId, rating, comment } = req.body;
    const userId = req.user._id;

    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
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
      gigId,
      userId,
      rating,
      comment
    });

    // Update gig ratings
    const gig = await Gig.findById(gigId);
    gig.totalStars += rating;
    gig.starNumber += 1;
    await gig.save();

    // Notify gig creator
    await NotificationService.createNotification({
      userId: order.gigCreatorId,
      type: 'review_received',
      title: 'New Review',
      message: `You received a ${rating}-star review`,
      relatedId: review._id,
      relatedModel: 'Review'
    });

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
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this review' });
    }

    const oldRating = review.rating;
    review.rating = rating;
    review.comment = comment;
    await review.save();

    // Update gig ratings
    const gig = await Gig.findById(review.gigId);
    gig.totalStars = gig.totalStars - oldRating + rating;
    await gig.save();

    res.json({ success: true, review });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const canDelete = 
      review.userId.toString() === userId.toString() ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }

    // Update gig ratings
    const gig = await Gig.findById(review.gigId);
    gig.totalStars -= review.rating;
    gig.starNumber -= 1;
    await gig.save();

    await Review.findByIdAndDelete(reviewId);

    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
};