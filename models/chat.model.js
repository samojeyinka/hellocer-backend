const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order"
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }],
  chatType: {
    type: String,
    enum: ["order", "direct"],
    default: "order"
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },
  lastMessageAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model("Chat", ChatSchema);