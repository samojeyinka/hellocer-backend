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
  username: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,   // allows multiple docs with no email
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    minlength: 6
  },
  skills: {
    type: [String],
    default: []
  },
  keywords: {
    type: [String],
    default: []
  },
  bio: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  postalCode: {
    type: String,
    trim: true,
    default: ''
  },
  country: {
    type: String,
    trim: true,
    default: ''
  },
  timeZone: {
    type: String,
    default: "UTC+00:00"
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
  passwordSetupToken: String,
  passwordSetupTokenExpires: Date,
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  // Settings Change OTP
  settingsChangeCode: String,
  settingsChangeCodeExpires: Date,

  // Preferences
  emailNotifications: {
    type: Boolean,
    default: true
  },
  directMessages: {
    type: Boolean,
    default: false
  },
}, { 
  timestamps: true
});

UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  if (!this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);