const Order = require('../models/order.model');
const Gig = require('../models/gig.model');
const NotificationService = require('../services/notification.service');

// ─── Create Gig ──────────────────────────────────────────────────────────────
exports.createGig = async (req, res) => {
  try {
    const gigData = { ...req.body, creator: req.user._id };
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

// ─── Get All Gigs (public — exclude soft-deleted and drafts) ─────────────────
exports.getAllGigs = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, tags, sort, page = 1, limit = 12 } = req.query;

    const query = { isActive: true, status: 'published', deletedAt: null };

    // Support single or multiple categories (comma separated)
    if (category) {
      if (category !== 'all' && category !== 'all-services') {
        const categories = category.split(',');
        const categoryIds = [];

        for (const cat of categories) {
          const isObjectId = /^[0-9a-fA-F]{24}$/.test(cat);
          if (isObjectId) {
            categoryIds.push(cat);
          } else {
            const Category = require('../models/category.model');
            const categoryDoc = await Category.findOne({ slug: cat });
            if (categoryDoc) {
              categoryIds.push(categoryDoc._id);
            }
          }
        }

        if (categoryIds.length > 0) {
          query.category = { $in: categoryIds };
        } else {
          return res.json({ success: true, gigs: [], pagination: { total: 0, page: parseInt(page), pages: 0 } });
        }
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (tags) {
      const tagList = tags.split(',');
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(tagList[0]);
      if (isObjectId) {
        query.tags = { $in: tagList };
      } else {
        const Tag = require('../models/tag.model');
        const tagDocs = await Tag.find({ name: { $in: tagList.map(t => new RegExp(`^${t}$`, 'i')) } });
        if (tagDocs.length > 0) {
          query.tags = { $in: tagDocs.map(td => td._id) };
        } else {
           return res.json({ success: true, gigs: [], pagination: { total: 0, page: parseInt(page), pages: 0 } });
        }
      }
    }

    if (minPrice || maxPrice) {
      query.$or = [
        { 'pricing.basic.price': { $gte: minPrice || 0, $lte: maxPrice || Infinity } },
        { 'pricing.standard.price': { $gte: minPrice || 0, $lte: maxPrice || Infinity } },
        { 'pricing.advanced.price': { $gte: minPrice || 0, $lte: maxPrice || Infinity } }
      ];
    }

    // Sorting logic
    let sortOption = { createdAt: -1 };
    if (sort === 'sales') {
      sortOption = { sales: -1 };
    } else if (sort === 'rating') {
      sortOption = { totalStars: -1 }; // Simplification for popular
    }

    const gigs = await Gig.find(query)
      .populate('category', 'name slug')
      .populate('creator', 'firstName lastName username profilePicture')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Gig.countDocuments(query);

    res.json({ success: true, gigs, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get gigs error:', error);
    res.status(500).json({ error: 'Failed to get gigs' });
  }
};

// ─── Get Admin Gigs (admin — all gigs with filters) ──────────────────────────
exports.getAdminGigs = async (req, res) => {
  try {
    const { status, isActive, trash, search, page = 1, limit = 20 } = req.query;

    // Trash mode: gigs that have been soft-deleted
    const query = trash === 'true'
      ? { deletedAt: { $ne: null } }
      : { deletedAt: null };

    if (status && status !== 'all') query.status = status;
    if (isActive !== undefined && isActive !== 'all') query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
      ];
    }

    const gigs = await Gig.find(query)
      .populate('creator', 'firstName lastName username profilePicture')
      .populate('hellocians', '_id firstName lastName username profilePicture')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Gig.countDocuments(query);

    res.json({ success: true, gigs, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get admin gigs error:', error);
    res.status(500).json({ error: 'Failed to get admin gigs' });
  }
};

// ─── Get Gig by ID ───────────────────────────────────────────────────────────
exports.getGigById = async (req, res) => {
  try {
    const { gigId } = req.params;

    let gig = await Gig.findById(gigId)
      .populate('category', 'name description')
      .populate('tags', 'name')
      .populate('creator', 'firstName lastName username profilePicture')
      .populate('hellocians', '_id firstName lastName username bio profilePicture');

    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    // Only increment clicks if it's a client
    if (req.user && req.user.role === 'user') {
      gig.clicks += 0.5;
      await gig.save();
    }

    const avgRating = gig.starNumber > 0 ? gig.totalStars / gig.starNumber : 0;
    res.json({ success: true, gig: { ...gig.toObject(), avgRating } });
  } catch (error) {
    console.error('Get gig error:', error);
    res.status(500).json({ error: 'Failed to get gig' });
  }
};

// ─── Get Gig by Slug (increment clicks) ─────────────────────────────────────
exports.getGigBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    let gig = await Gig.findOne({ slug })
      .populate('category', 'name description')
      .populate('tags', 'name')
      .populate('creator', 'firstName lastName username profilePicture')
      .populate('hellocians', '_id firstName lastName username bio profilePicture');

    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    // Only increment clicks if it's a client
    if (req.user && req.user.role === 'user') {
      gig.clicks += 0.5;
      await gig.save();
    }

    const avgRating = gig.starNumber > 0 ? gig.totalStars / gig.starNumber : 0;
    res.json({ success: true, gig: { ...gig.toObject(), avgRating } });
  } catch (error) {
    console.error('Get gig by slug error:', error);
    res.status(500).json({ error: 'Failed to get gig' });
  }
};

// ─── Update Gig ──────────────────────────────────────────────────────────────
exports.updateGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const canUpdate = gig.creator.toString() === req.user._id.toString() ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!canUpdate) return res.status(403).json({ error: 'Not authorized to update this gig' });

    const updatedGig = await Gig.findByIdAndUpdate(gigId, req.body, { new: true, runValidators: true })
      .populate('hellocians', '_id firstName lastName username bio profilePicture')
      .populate('category', 'name slug')
      .populate('tags', 'name');

    res.json({ success: true, gig: updatedGig });
  } catch (error) {
    console.error('Update gig error:', error);
    res.status(500).json({ error: 'Failed to update gig' });
  }
};

// ─── Soft Delete Gig ─────────────────────────────────────────────────────────
exports.deleteGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const canDelete = gig.creator.toString() === req.user._id.toString() ||
      ['admin', 'super-admin'].includes(req.user.role);

    if (!canDelete) return res.status(403).json({ error: 'Not authorized to delete this gig' });

    // Check for active orders
    const activeOrders = await Order.find({ gigId, status: { $in: ['pending', 'in-progress'] } });
    if (activeOrders.length > 0) {
      return res.status(400).json({ error: 'Cannot delete gig with active orders' });
    }

    // Soft delete — set deletedAt
    await Gig.findByIdAndUpdate(gigId, { deletedAt: new Date() });

    res.json({ success: true, message: 'Gig moved to trash' });
  } catch (error) {
    console.error('Delete gig error:', error);
    res.status(500).json({ error: 'Failed to delete gig' });
  }
};

// ─── Restore Gig from Trash (within 30 days) ─────────────────────────────────
exports.restoreGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ error: 'Gig not found' });
    if (!gig.deletedAt) return res.status(400).json({ error: 'Gig is not in the trash' });

    const daysSinceDelete = (Date.now() - new Date(gig.deletedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelete > 30) {
      return res.status(400).json({ error: 'Gig has been in trash for more than 30 days and cannot be restored' });
    }

    await Gig.findByIdAndUpdate(gigId, { deletedAt: null });
    res.json({ success: true, message: 'Gig restored successfully' });
  } catch (error) {
    console.error('Restore gig error:', error);
    res.status(500).json({ error: 'Failed to restore gig' });
  }
};

// ─── Hard Delete Gig (permanent) ─────────────────────────────────────────────
exports.hardDeleteGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    await Gig.findByIdAndDelete(gigId);
    res.json({ success: true, message: 'Gig permanently deleted' });
  } catch (error) {
    console.error('Hard delete gig error:', error);
    res.status(500).json({ error: 'Failed to permanently delete gig' });
  }
};

// ─── Toggle isActive ─────────────────────────────────────────────────────────
exports.toggleActive = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const updatedGig = await Gig.findByIdAndUpdate(
      gigId,
      { isActive: !gig.isActive },
      { new: true }
    );

    res.json({ success: true, gig: updatedGig, message: `Gig ${updatedGig.isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({ error: 'Failed to toggle gig status' });
  }
};

// ─── Duplicate Gig ───────────────────────────────────────────────────────────
exports.duplicateGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const original = await Gig.findById(gigId);
    if (!original) return res.status(404).json({ error: 'Gig not found' });

    const gigData = original.toObject();
    delete gigData._id;
    delete gigData.createdAt;
    delete gigData.updatedAt;
    delete gigData.__v;
    gigData.title = `${original.title} (Copy)`;
    gigData.slug = undefined; // let pre-save hook generate a new slug
    gigData.clicks = 0;
    gigData.sales = 0;
    gigData.totalStars = 0;
    gigData.starNumber = 0;
    gigData.deletedAt = null;
    gigData.status = 'draft'; // duplicate starts as a draft
    gigData.creator = req.user._id;

    const newGig = await Gig.create(gigData);
    const populatedGig = await Gig.findById(newGig._id)
      .populate('hellocians', '_id firstName lastName username bio profilePicture')
      .populate('category', 'name slug')
      .populate('tags', 'name');

    res.status(201).json({ success: true, gig: populatedGig, message: 'Gig duplicated successfully' });
  } catch (error) {
    console.error('Duplicate gig error:', error);
    res.status(500).json({ error: 'Failed to duplicate gig' });
  }
};

// ─── Toggle Accepting Orders ──────────────────────────────────────────────────
exports.toggleAcceptingOrders = async (req, res) => {
  try {
    const { gigId } = req.params;
    const { isAcceptingOrders } = req.body;

    const gig = await Gig.findByIdAndUpdate(gigId, { isAcceptingOrders }, { new: true });
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    res.json({ success: true, gig });
  } catch (error) {
    console.error('Toggle accepting orders error:', error);
    res.status(500).json({ error: 'Failed to update gig status' });
  }
};
// ─── Get Similar Gigs ─────────────────────────────────────────────────────────
exports.getSimilarGigs = async (req, res) => {
  try {
    const { gigId } = req.params;

    const currentGig = await Gig.findById(gigId);
    if (!currentGig) return res.status(404).json({ error: 'Gig not found' });

    const similarGigs = await Gig.find({
      _id: { $ne: gigId },
      isActive: true,
      status: 'published',
      deletedAt: null,
      $or: [
        { category: { $in: currentGig.category } },
        { tags: { $in: currentGig.tags } }
      ]
    })
    .populate('creator', 'firstName lastName username profilePicture')
    .limit(8);

    const gigsWithRating = similarGigs.map(g => {
      const gigObj = g.toObject();
      gigObj.avgRating = g.starNumber > 0 ? g.totalStars / g.starNumber : 0;
      return gigObj;
    });

    res.json({ success: true, gigs: gigsWithRating });
  } catch (error) {
    console.error('Get similar gigs error:', error);
    res.status(500).json({ error: 'Failed to get similar gigs' });
  }
};
// ─── Get All Tags ────────────────────────────────────────────────────────────
exports.getAllTags = async (req, res) => {
  try {
    const Tag = require('../models/tag.model');
    const tags = await Tag.find().sort({ name: 1 });
    res.json({ success: true, tags });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
};

// ─── Get Showcase Data for Home Page ──────────────────────────────────────────
exports.getShowcaseData = async (req, res) => {
  try {
    const Category = require('../models/category.model');
    let handpickedCategories = [];

    // 1. Get Handpicked Recommendations
    if (req.user) {
      // Find categories from previous orders
      const userOrders = await Order.find({ clientId: req.user._id }).distinct('gigCategory');
      // Find categories from bookmarks (need to populate or lookup)
      const user = await User.findById(req.user._id).populate({
        path: 'savedGigs',
        select: 'category'
      });
      
      const bookmarkedCategories = user?.savedGigs?.flatMap(g => g.category.map(c => c.toString())) || [];
      handpickedCategories = [...new Set([...userOrders, ...bookmarkedCategories])];
    }

    let handpickedGigs;
    if (handpickedCategories.length > 0) {
      handpickedGigs = await Gig.find({
        category: { $in: handpickedCategories },
        isActive: true,
        status: 'published',
        deletedAt: null
      })
      .sort({ sales: -1, totalStars: -1 })
      .limit(4);
    }

    // Fallback/Guest: Handpicked = Best Selling
    const bestSellingGigs = await Gig.find({
      isActive: true,
      status: 'published',
      deletedAt: null
    })
    .sort({ sales: -1 })
    .limit(4);

    if (!handpickedGigs || handpickedGigs.length === 0) {
      handpickedGigs = bestSellingGigs;
    }

    // 2. Find Best Performing Category (most sales)
    const categoryStats = await Gig.aggregate([
      { $match: { isActive: true, status: 'published', deletedAt: null } },
      { $unwind: '$category' },
      { $group: { _id: '$category', totalSales: { $sum: '$sales' } } },
      { $sort: { totalSales: -1 } },
      { $limit: 1 }
    ]);

    let bestCategory = null;
    if (categoryStats.length > 0) {
      const catDoc = await Category.findById(categoryStats[0]._id);
      if (catDoc) {
        // Find best gig in this category
        const topGig = await Gig.findOne({
          category: catDoc._id,
          isActive: true,
          status: 'published',
          deletedAt: null
        }).sort({ sales: -1 });

        bestCategory = {
          _id: catDoc._id,
          name: catDoc.name,
          slug: catDoc.slug,
          topGig: topGig ? { slug: topGig.slug, cover: topGig.cover, title: topGig.title } : null
        };
      }
    }

    res.json({
      success: true,
      data: {
        handpicked: handpickedGigs,
        bestCategory: bestCategory,
        bestSelling: bestSellingGigs
      }
    });

  } catch (error) {
    console.error('Get showcase data error:', error);
    res.status(500).json({ error: 'Failed to get showcase data' });
  }
};
