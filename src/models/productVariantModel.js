const mongoose = require("mongoose");

const productVariantSchema = new mongoose.Schema(
  {
    // =====================================================
    // PRODUCT
    // =====================================================

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    // =====================================================
    // SIZE
    // =====================================================

    size: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Size",
      required: true,
      index: true,
    },

    // =====================================================
    // COLOR
    // =====================================================

    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: true,
      index: true,
    },

    // =====================================================
    // SKU
    // =====================================================

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // =====================================================
    // MRP
    // =====================================================

    mrp: {
      type: Number,
      required: true,
      min: 0,
    },

    // =====================================================
    // SELLING PRICE
    // =====================================================

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // =====================================================
    // STOCK
    // =====================================================

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // =====================================================
    // LOW STOCK THRESHOLD
    // =====================================================

    lowStockThreshold: {
      type: Number,
      min: 0,
      default: 5,
    },

    // =====================================================
    // VARIANT IMAGES
    // =====================================================

    images: [
      {
        type: String,
        trim: true,
      },
    ],

    // =====================================================
    // STATUS
    // =====================================================

    status: {
      type: String,
      enum: ["active", "inactive", "out_of_stock"],
      default: "active",
      index: true,
    },

    // =====================================================
    // DEFAULT VARIANT
    // =====================================================

    isDefault: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // AUDIT
    // =====================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


// =====================================================
// PREVENT DUPLICATE PRODUCT + SIZE + COLOR
//
// Example:
// Product A + M + Black  → allowed once
// Product A + M + Black  → duplicate ❌
// Product A + L + Black  → allowed
// Product A + M + Pink   → allowed
// =====================================================

productVariantSchema.index(
  {
    product: 1,
    size: 1,
    color: 1,
  },
  {
    unique: true,
  }
);


// =====================================================
// EXPORT
// =====================================================

module.exports =
  mongoose.models.ProductVariant ||
  mongoose.model(
    "ProductVariant",
    productVariantSchema
  );