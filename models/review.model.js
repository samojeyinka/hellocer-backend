const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true
  },
  gigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gig",
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  deliverySpeed: {
    type: String,
    enum: ['fast', 'extra-fast', 'express']
  },
  comment: {
    type: String,
    required: true
  },
  response: {
    comment: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    respondedAt: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Review", ReviewSchema);