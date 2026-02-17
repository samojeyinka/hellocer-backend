const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: [
      "order_created",
      "order_updated",
      "order_completed",
      "order_cancelled",
      "message_received",
      "review_received",
      "payment_received",
      "account_blocked",
      "account_unblocked",
      "gig_assigned",
      "admin_message"
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: mongoose.Schema.Types.ObjectId,
  relatedModel: {
    type: String,
    enum: ["Order", "Message", "Review", "Gig", "User"]
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model("Notification", NotificationSchema);