const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    // ==========================================
    // PRODUCT
    // ==========================================

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },

    // ==========================================
    // STOCK
    // ==========================================

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

    // ==========================================
    // LOW STOCK
    // ==========================================

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },

    reorderQuantity: {
      type: Number,
      default: 10,
      min: 0,
    },

    // ==========================================
    // STOCK VALUE
    // ==========================================

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

    // ==========================================
    // STOCK STATUS
    // ==========================================

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

    // ==========================================
    // LAST STOCK MOVEMENT
    // ==========================================

    lastStockIn: {
      type: Date,
      default: null,
    },

    lastStockOut: {
      type: Date,
      default: null,
    },

    // ==========================================
    // ACTIVE / DELETE
    // ==========================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// ==========================================
// INDEXES
// ==========================================

inventorySchema.index({
  stockStatus: 1,
  quantity: 1,
});

inventorySchema.index({
  productId: 1,
  isDeleted: 1,
});

// ==========================================
// PRE SAVE
// ==========================================

inventorySchema.pre("save", function () {
  // Calculate available quantity
  this.availableQuantity = Math.max(
    0,
    this.quantity - this.reservedQuantity
  );

  // Calculate stock status
  if (this.availableQuantity <= 0) {
    this.stockStatus = "OUT_OF_STOCK";
  } else if (
    this.availableQuantity <= this.lowStockThreshold
  ) {
    this.stockStatus = "LOW_STOCK";
  } else {
    this.stockStatus = "IN_STOCK";
  }

 
});

module.exports =
  mongoose.models.Inventory ||
  mongoose.model("Inventory", inventorySchema);