
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
// INDEX
// ==========================================================

wishlistSchema.index({
  user: 1,
});

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model("Wishlist", wishlistSchema);

