const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profilePicture: {
    type: String,
    default: ""
  },
  role: {
    type: String,
    enum: ["user", "hellocian", "admin", "super-admin"],
    default: "user"
  },
  isActivated: {
    type: Boolean,
    default: false
  },
  activationCode: {
    type: String
  },
  activationCodeExpires: {
    type: Date
  },
  isBlocked: {
    type: Boolean,
    default: false
  },


  refreshToken: {
  type: String,
  default: null
},
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  blockedAt: {
    type: Date
  },
  resetPasswordToken: String, 
  resetPasswordExpires: Date,
}, { 
  timestamps: true
});

UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);