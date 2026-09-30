const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },
    quantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    availableQuantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    reorderQuantity: { type: Number, default: 10, min: 0 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    stockStatus: {
      type: String,
      enum: ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"],
      default: "OUT_OF_STOCK",
      index: true,
    },
    lastStockIn: { type: Date, default: null },
    lastStockOut: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

inventorySchema.pre("save", function () {
  this.availableQuantity = Math.max(0, this.quantity - this.reservedQuantity);
  if (this.availableQuantity <= 0) {
    this.stockStatus = "OUT_OF_STOCK";
  } else if (this.availableQuantity <= this.lowStockThreshold) {
    this.stockStatus = "LOW_STOCK";
  } else {
    this.stockStatus = "IN_STOCK";
  }
});

module.exports = mongoose.models.Inventory || mongoose.model("Inventory", inventorySchema);