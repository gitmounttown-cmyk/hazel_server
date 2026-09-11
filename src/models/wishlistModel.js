const mongoose = require("mongoose");

// ==========================================================
// WISHLIST ITEM SCHEMA
// ==========================================================

const wishlistItemSchema = new mongoose.Schema(
  {
    // ------------------------------------------------------
    // PRODUCT
    // ------------------------------------------------------

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // ------------------------------------------------------
    // PRODUCT VARIANT
    // ------------------------------------------------------

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    // ------------------------------------------------------
    // ADDED PRICE SNAPSHOT
    // ------------------------------------------------------

    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ------------------------------------------------------
    // PRODUCT NAME SNAPSHOT
    // ------------------------------------------------------

    productName: {
      type: String,
      default: "",
      trim: true,
    },

    // ------------------------------------------------------
    // PRODUCT IMAGE SNAPSHOT
    // ------------------------------------------------------

    image: {
      type: String,
      default: "",
    },

    // ------------------------------------------------------
    // SIZE SNAPSHOT
    // ------------------------------------------------------

    size: {
      type: String,
      default: "",
      trim: true,
    },

    // ------------------------------------------------------
    // COLOR SNAPSHOT
    // ------------------------------------------------------

    color: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

// ==========================================================
// WISHLIST SCHEMA
// ==========================================================

const wishlistSchema = new mongoose.Schema(
  {
    // ------------------------------------------------------
    // USER
    // ------------------------------------------------------

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      required: true,
      unique: true,
      index: true,
    },

    // ------------------------------------------------------
    // WISHLIST ITEMS
    // ------------------------------------------------------

    items: {
      type: [wishlistItemSchema],
      default: [],
    },

    // ------------------------------------------------------
    // STATUS
    // ------------------------------------------------------

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================================
// PREVENT SAME VARIANT DUPLICATE
// ==========================================================

wishlistSchema.index(
  {
    user: 1,
    "items.variant": 1,
  }
);

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model(
  "Wishlist",
  wishlistSchema
);