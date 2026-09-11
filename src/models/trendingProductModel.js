const mongoose = require("mongoose");

// ==========================================================
// TRENDING PRODUCT ITEM SCHEMA
// ==========================================================

const TrendingProductItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    image: {
      type: String,
      default: null,
    },

    displayOrder: {
      type: Number,
      default: 1,
      min: 1,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
  }
);

// ==========================================================
// TRENDING PRODUCT SCHEMA
// ==========================================================

const TrendingProductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: false,
      trim: true,
      default: "Trending Products",
    },

    subtitle: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },

    products: {
      type: [TrendingProductItemSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model(
  "TrendingProduct",
  TrendingProductSchema
);