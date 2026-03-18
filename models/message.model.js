const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  content: {
    type: String
  },
  attachments: [{
    url: String,
    name: String,
    size: String,
    type: {
      type: String,
      enum: ["image", "document"]
    }
  }],
  isRead: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    readAt: Date
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model("Message", MessageSchema);