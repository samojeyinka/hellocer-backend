const mongoose = require("mongoose");
 
const OrderSchema = new mongoose.Schema({
  gigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gig",
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  gigCreatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  hellocians: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  title: {
    type: String,
    required: true
  },
  img: String,
  gigCategory: [String],
  pricingPackage: {
    type: String,
    enum: ["basic", "standard", "advanced", "pro", "premium"],
    required: true
  }, 
  price: {
    type: Number,
    required: true
  },
  payment_method: {
    type: String,
    required: true
  },
  payment_intent: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed", "cancelled", "disputed"],
    default: "pending"
  },
  deliveryTimeframe: String,
  deliveryDate: Date,
  deliveredAt: Date,
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Order", OrderSchema);