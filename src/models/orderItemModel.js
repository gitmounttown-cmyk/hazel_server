const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    // =========================================================
    // ORDER
    // =========================================================
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
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
    },

    // =========================================================
    // PRODUCT VARIANT
    // =========================================================
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    // =========================================================
    // PRODUCT SNAPSHOT
    // =========================================================
    productName: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },

    size: {
      type: String,
      trim: true,
      default: "",
    },

    color: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // PRICE
    // =========================================================
    mrp: {
      type: Number,
      required: true,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // =========================================================
    // ITEM STATUS
    // =========================================================
    itemStatus: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURN_REQUESTED",
        "RETURNED",
        "REFUNDED",
      ],
      default: "PENDING",
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },

    returnReason: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // REVIEW
    // =========================================================
    isReviewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.OrderItem ||
  mongoose.model("OrderItem", orderItemSchema);