const mongoose = require("mongoose");

const GigSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }, 
  title: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  category: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  }],
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tag"
  }],
  hellocians: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  totalStars: {
    type: Number,
    default: 0
  },
  starNumber: {
    type: Number,
    default: 0
  },
  pricing: {
    basic: {
      name: { type: String, default: "basic" },
      title: String,
      description: String,
      deliveryTimeframe: String,
      price: Number
    },
    standard: {
      name: { type: String, default: "standard" },
      title: String,
      description: String,
      deliveryTimeframe: String,
      price: Number
    },
    advanced: {
      name: { type: String, default: "advanced" },
      title: String,
      description: String,
      deliveryTimeframe: String,
      price: Number
    },
    pro: {
      name: { type: String, default: "pro" },
      title: String,
      description: String,
      deliveryTimeframe: String,
      price: Number
    },
    premium: {
      name: { type: String, default: "premium" },
      title: String,
      description: String,
      deliveryTimeframe: String,
      price: Number
    }
  },
  addons: [{
    name: String,
    values: {
      basic: String,
      standard: String,
      advanced: String,
      pro: String,
      premium: String
    }
  }],
  cover: {
    type: String,
    required: true
  },
  firstThumbnail: String,
  secondThumbnail: String,
  thirdThumbnail: String,
  sales: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isAcceptingOrders: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate slug
GigSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, ''); // Remove leading/trailing hyphens
  }
  next();
});

module.exports = mongoose.model("Gig", GigSchema);