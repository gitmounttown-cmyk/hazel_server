const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    // ==========================================================
    // MOBILE NUMBER
    // ==========================================================

    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ==========================================================
    // OTP
    // ==========================================================

    otp: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================================
    // PURPOSE
    // ==========================================================

    purpose: {
      type: String,
      enum: [
        "LOGIN",
        "REGISTER",
        "FORGOT_PASSWORD",
      ],
      default: "LOGIN",
      index: true,
    },

    // ==========================================================
    // EXPIRY
    // ==========================================================

    expiresAt: {
      type: Date,
      required: true,
    },

    // ==========================================================
    // VERIFICATION STATUS
    // ==========================================================

    isVerified: {
      type: Boolean,
      default: false,
    },

    // ==========================================================
    // ATTEMPTS
    // ==========================================================

    attempts: {
      type: Number,
      default: 0,
    },

    // ==========================================================
    // MAXIMUM ATTEMPTS
    // ==========================================================

    maxAttempts: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// TTL INDEX
// MongoDB automatically removes document when expiresAt arrives
// ============================================================

otpSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
  }
);

// ============================================================
// PREVENT OverwriteModelError
// ============================================================

module.exports =
  mongoose.models.OTP ||
  mongoose.model("OTP", otpSchema);