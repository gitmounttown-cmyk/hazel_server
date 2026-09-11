const mongoose = require("mongoose");

const stockHistorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },

    // ==========================================
    // MOVEMENT
    // ==========================================

    type: {
      type: String,
      enum: [
        "STOCK_IN",
        "STOCK_OUT",
        "ADJUSTMENT",
        "SALE",
        "SALE_RETURN",
        "PURCHASE",
        "PURCHASE_RETURN",
        "CANCELLED_ORDER",
      ],
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    // ==========================================
    // REFERENCE
    // ==========================================

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    referenceType: {
      type: String,
      default: "",
      trim: true,
    },

    reason: {
      type: String,
      default: "",
      trim: true,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

stockHistorySchema.index({
  productId: 1,
  createdAt: -1,
});

stockHistorySchema.index({
  type: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.StockHistory ||
  mongoose.model(
    "StockHistory",
    stockHistorySchema
  );