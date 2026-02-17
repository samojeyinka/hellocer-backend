const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  full_name: String,
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  gigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gig",
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order"
  },
  pricingPackage: {
    type: String,
    enum: ["basic", "standard", "advanced", "pro", "premium"],
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "failed", "refunded"],
    default: "pending"
  },
  payment_method: {
    type: String,
    required: true
  },
  payment_intent: {
    type: String,
    required: true,
    unique: true
  },
  currency: {
    type: String,
    default: "USD"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Payment", PaymentSchema);