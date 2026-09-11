const mongoose = require("mongoose");

const subCategorySchema = new mongoose.Schema(
  {
    // ==========================================
    // SUB CATEGORY NAME
    // ==========================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================
    // SUB CATEGORY IMAGE
    // ==========================================

    imageURL: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================
    // PARENT CATEGORY
    // ==========================================

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    // ==========================================
    // CREATED DATE
    // ==========================================

    createdAt: {
      type: Date,
      default: Date.now,
    },

    // ==========================================
    // UPDATED DATE
    // ==========================================

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model("SubCategory", subCategorySchema);