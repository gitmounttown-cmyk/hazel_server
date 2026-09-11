const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },

    otp: {
      type: String,
      required: true,
      trim: true,
    },

    purpose: {
      type: String,
      enum: ["LOGIN", "REGISTER", "FORGOT_PASSWORD"],
      default: "LOGIN",
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

// Automatically delete OTP after expiresAt
otpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Prevent OverwriteModelError
module.exports =
  mongoose.models.OTP ||
  mongoose.model("OTP", otpSchema);