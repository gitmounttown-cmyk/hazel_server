const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    isGuest: {
      type: Boolean,
      default: false,
      index: true,
    },
    // ------------------------------------------------------
    // GUEST
    // ------------------------------------------------------
    guestId: {
      type: String,
      default: null,
      index: true,
    },

    name: {
      type: String,
      trim: true,
      default: null,
    },
    mobileNumber: {
      type: String,
      // unique: true,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      // unique: true,
      sparse: true,
      default: "",
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["customer", "admin", "superAdmin"],
      default: "customer",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


userSchema.index(
  { guestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isGuest: true,
      guestId: { $type: "string" },
    },
  }
);

userSchema.index(
  { mobileNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isGuest: false,
      mobileNumber: { $gt: "" },
    },
  }
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isGuest: false,
      email: { $gt: "" },
    },
  }
);


module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);