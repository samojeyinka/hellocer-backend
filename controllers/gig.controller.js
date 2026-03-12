const Order = require('../models/order.model');
const Gig = require('../models/gig.model');
const NotificationService = require('../services/notification.service');

exports.createGig = async (req, res) => {
  try {
    const gigData = {
      ...req.body,
      creator: req.user._id
    };

    const gig = await Gig.create(gigData);

    // Notify assigned hellocians
    if (gig.hellocians && gig.hellocians.length > 0) {
      for (const hellocianId of gig.hellocians) {
        await NotificationService.createNotification({
          userId: hellocianId,
          type: 'gig_assigned',
          title: 'New Gig Assignment',
          message: `You have been assigned to a new gig: ${gig.title}`,
          relatedId: gig._id,
          relatedModel: 'Gig'
        });
      }
    }

    // Populate hellocian details so response reflects real data (not hardcoded)
    const populatedGig = await Gig.findById(gig._id)
      .populate('hellocians', '_id firstName lastName username bio profilePicture')
      .populate('category', 'name slug')
      .populate('tags', 'name');

    res.status(201).json({ success: true, gig: populatedGig });
  } catch (error) {
    console.error('Create gig error:', error);
    res.status(500).json({ error: error.message, details: error.message });
  }
};

exports.getAllGigs = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, page = 1, limit = 12 } = req.query;

    const query = { isActive: true, status: 'published' };

    if (category) {
      if (category !== 'all' && category !== 'all-services') {
        // Check if category is an ObjectId or a slug
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(category);
        
        if (isObjectId) {
          query.category = category;
        } else {
          // It's a slug, find the category first
          const Category = require('../models/category.model');
          const categoryDoc = await Category.findOne({ slug: category });
          
          if (categoryDoc) {
            query.category = categoryDoc._id;
          } else {
            // If category slug not found, maybe return empty or ignore?
            // Let's return empty to be correct
            return res.json({
              success: true,
              gigs: [],
              pagination: {
                total: 0,
                page: parseInt(page),
                pages: 0
              }
            });
          }
        }
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (minPrice || maxPrice) {
      query.$or = [
        { 'pricing.basic.price': { $gte: minPrice || 0, $lte: maxPrice || Infinity } },
        { 'pricing.standard.price': { $gte: minPrice || 0, $lte: maxPrice || Infinity } },
        { 'pricing.advanced.price': { $gte: minPrice || 0, $lte: maxPrice || Infinity } }
      ];
    }

    const gigs = await Gig.find(query)
      .populate('category', 'name slug')
      .populate('creator', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Gig.countDocuments(query);

    res.json({
      success: true,
      gigs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get gigs error:', error);
    res.status(500).json({ error: 'Failed to get gigs' });
  }
};

exports.getGigById = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId)
      .populate('category', 'name description')
      .populate('tags', 'name')
      .populate('creator', 'firstName lastName profilePicture')
      .populate('hellocians', '_id firstName lastName username bio profilePicture');

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const avgRating = gig.starNumber > 0 ? gig.totalStars / gig.starNumber : 0;

    res.json({ success: true, gig: { ...gig.toObject(), avgRating } });
  } catch (error) {
    console.error('Get gig error:', error);
    res.status(500).json({ error: 'Failed to get gig' });
  }
};

exports.getGigBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const gig = await Gig.findOne({ slug })
      .populate('category', 'name description')
      .populate('tags', 'name')
      .populate('creator', 'firstName lastName profilePicture')
      .populate('hellocians', '_id firstName lastName username bio profilePicture');

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const avgRating = gig.starNumber > 0 ? gig.totalStars / gig.starNumber : 0;

    res.json({ success: true, gig: { ...gig.toObject(), avgRating } });
  } catch (error) {
    console.error('Get gig by slug error:', error);
    res.status(500).json({ error: 'Failed to get gig' });
  }
};

exports.updateGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Check permissions
    const canUpdate = 
      gig.creator.toString() === req.user._id.toString() ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!canUpdate) {
      return res.status(403).json({ error: 'Not authorized to update this gig' });
    }

    const updatedGig = await Gig.findByIdAndUpdate(
      gigId,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({ success: true, gig: updatedGig });
  } catch (error) {
    console.error('Update gig error:', error);
    res.status(500).json({ error: 'Failed to update gig' });
  }
};

exports.deleteGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const canDelete = 
      gig.creator.toString() === req.user._id.toString() ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({ error: 'Not authorized to delete this gig' });
    }

    // Check for active orders
    const activeOrders = await Order.find({
      gigId,
      status: { $in: ['pending', 'in-progress'] }
    });

    if (activeOrders.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete gig with active orders'
      });
    }

    await Gig.findByIdAndDelete(gigId);

    res.json({ success: true, message: 'Gig deleted successfully' });
  } catch (error) {
    console.error('Delete gig error:', error);
    res.status(500).json({ error: 'Failed to delete gig' });
  }
};

exports.toggleAcceptingOrders = async (req, res) => {
  try {
    const { gigId } = req.params;
    const { isAcceptingOrders } = req.body;

    const gig = await Gig.findByIdAndUpdate(
      gigId,
      { isAcceptingOrders },
      { new: true }
    );

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    res.json({ success: true, gig });
  } catch (error) {
    console.error('Toggle accepting orders error:', error);
    res.status(500).json({ error: 'Failed to update gig status' });
  }
};
