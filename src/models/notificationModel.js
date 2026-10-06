const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema(
  {
    // ============================================================
    // PRODUCT
    // ============================================================

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },

    // ============================================================
    // STOCK
    // ============================================================

    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    availableQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================================
    // STOCK SETTINGS
    // ============================================================

    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },

    reorderQuantity: {
      type: Number,
      default: 10,
      min: 0,
    },

    // ============================================================
    // PRICE
    // ============================================================

    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================================
    // STATUS
    // ============================================================

    stockStatus: {
      type: String,
      enum: [
        "IN_STOCK",
        "LOW_STOCK",
        "OUT_OF_STOCK",
      ],
      default: "OUT_OF_STOCK",
      index: true,
    },

    // ============================================================
    // STOCK MOVEMENT
    // ============================================================

    lastStockIn: {
      type: Date,
      default: null,
    },

    lastStockOut: {
      type: Date,
      default: null,
    },

    // ============================================================
    // STATUS
    // ============================================================

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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

// ============================================================
// INDEXES
// ============================================================

InventorySchema.index({
  stockStatus: 1,
  isDeleted: 1,
});

InventorySchema.index({
  availableQuantity: 1,
});

InventorySchema.index({
  createdAt: -1,
});

module.exports = mongoose.model(
  "Inventory",
  InventorySchema
);