const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ==========================================================
    // NAME
    // ==========================================================

    name: {
      type: String,
      trim: true,
      default: null,
    },

    // ==========================================================
    // MOBILE NUMBER
    // ==========================================================

    mobileNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // ==========================================================
    // EMAIL
    // ==========================================================

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },

    // ==========================================================
    // GOOGLE ID
    // ==========================================================

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // ==========================================================
    // PROFILE IMAGE
    // ==========================================================

    profileImage: {
      type: String,
      default: null,
    },

    // ==========================================================
    // ROLE
    // ==========================================================

    role: {
      type: String,
      enum: [
        "customer",
        "admin",
        "superAdmin",
      ],
      default: "customer",
    },

    // ==========================================================
    // VERIFIED
    // ==========================================================

    isVerified: {
      type: Boolean,
      default: false,
    },

    // ==========================================================
    // ACTIVE STATUS
    // ==========================================================

    isActive: {
      type: Boolean,
      default: true,
    },

    // ==========================================================
    // LAST LOGIN
    // ==========================================================

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);