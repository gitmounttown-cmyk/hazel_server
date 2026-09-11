const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
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
    // NOTIFICATION
    // =========================================================
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "ORDER",
        "PAYMENT",
        "DELIVERY",
        "OFFER",
        "COUPON",
        "REVIEW",
        "SYSTEM",
        "OTHER",
      ],
      default: "SYSTEM",
      index: true,
    },

    // =========================================================
    // OPTIONAL REFERENCES
    // =========================================================
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    // =========================================================
    // REDIRECT
    // =========================================================
    redirectType: {
      type: String,
      enum: [
        "NONE",
        "ORDER",
        "PRODUCT",
        "CATEGORY",
        "COUPON",
        "URL",
      ],
      default: "NONE",
    },

    redirectId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    redirectUrl: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // READ STATUS
    // =========================================================
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // =========================================================
    // SOFT DELETE
    // =========================================================
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);