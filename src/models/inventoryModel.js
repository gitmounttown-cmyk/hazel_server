const mongoose = require("mongoose");

// ============================================================
// INVENTORY SIZE SCHEMA
// ============================================================

const InventorySizeSchema = new mongoose.Schema(
  {
    sizeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    size: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    sku: {
      type: String,
      trim: true,
      default: "",
    },

    barcode: {
      type: String,
      trim: true,
      default: "",
    },

    stockQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

// ============================================================
// INVENTORY VARIANT SCHEMA
// ============================================================

const InventoryVariantSchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    color: {
      type: String,
      trim: true,
      default: "",
    },

    sizes: {
      type: [InventorySizeSchema],
      default: [],
    },
  },
  {
    _id: false,
  }
);

// ============================================================
// INVENTORY SCHEMA
// ============================================================

const InventorySchema = new mongoose.Schema(
  {
    // ----------------------------------------------------------
    // PRODUCT
    // ----------------------------------------------------------

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },

    // ----------------------------------------------------------
    // STOCK
    // ----------------------------------------------------------

    totalStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    availableStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ----------------------------------------------------------
    // LOW STOCK THRESHOLD
    // ----------------------------------------------------------

    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },

    // ----------------------------------------------------------
    // STOCK STATUS
    // ----------------------------------------------------------

    stockStatus: {
      type: String,
      enum: [
        "IN_STOCK",
        "LOW_STOCK",
        "OUT_OF_STOCK",
      ],
      default: "OUT_OF_STOCK",
    },

    // ----------------------------------------------------------
    // VARIANTS
    // ----------------------------------------------------------

    variants: {
      type: [InventoryVariantSchema],
      default: [],
    },

    // ----------------------------------------------------------
    // LAST SYNC
    // ----------------------------------------------------------

    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },

  {
    timestamps: true,
  }
);

// ============================================================
// SAFE MODEL EXPORT
// ============================================================

const Inventory =
  mongoose.models.Inventory ||
  mongoose.model("Inventory", InventorySchema);

module.exports = Inventory;