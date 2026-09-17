const mongoose = require("mongoose");

// ============================================================
// CART ITEM SCHEMA
// ============================================================

const cartItemSchema = new mongoose.Schema(
  {
    // ----------------------------------------------------------
    // Product
    // ----------------------------------------------------------

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    // ----------------------------------------------------------
    // Quantity
    // ----------------------------------------------------------

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // ----------------------------------------------------------
    // Original Product Price
    // ----------------------------------------------------------

    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // ----------------------------------------------------------
    // Discount Price
    // ----------------------------------------------------------

    discountPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    _id: true,
  },
);

// ============================================================
// CART SCHEMA
// ============================================================

const cartSchema = new mongoose.Schema(
  {
    // ----------------------------------------------------------
    // User
    // ----------------------------------------------------------

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      required: true,
      unique: true,
      index: true,
    },

    // ----------------------------------------------------------
    // Cart Items
    // ----------------------------------------------------------

    items: {
      type: [cartItemSchema],
      default: [],
    },

    // ----------------------------------------------------------
    // Total Items
    // ----------------------------------------------------------

    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ----------------------------------------------------------
    // Total Amount
    // ----------------------------------------------------------

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ----------------------------------------------------------
    // Cart Status
    // ----------------------------------------------------------

    status: {
      type: String,
      enum: ["active", "ordered", "abandoned"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model("Cart", cartSchema);
