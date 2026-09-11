const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // =========================================================
    // USER
    // =========================================================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =========================================================
    // PRODUCT
    // =========================================================
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    // =========================================================
    // ORDER
    // =========================================================
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    orderItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderItem",
      default: null,
    },

    // =========================================================
    // RATING
    // =========================================================
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    images: [
      {
        type: String,
        trim: true,
      },
    ],

    // =========================================================
    // ADMIN MODERATION
    // =========================================================
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // HELPFUL
    // =========================================================
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================================================
    // SOFT DELETE
    // =========================================================
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One review per user for an order item
reviewSchema.index(
  { user: 1, orderItem: 1 },
  { unique: true, sparse: true }
);

module.exports =
  mongoose.models.Review ||
  mongoose.model("Review", reviewSchema);