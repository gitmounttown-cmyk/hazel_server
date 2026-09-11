const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    // =========================================================
    // COUPON CODE
    // =========================================================
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // DISCOUNT
    // =========================================================
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    // =========================================================
    // ORDER CONDITIONS
    // =========================================================
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    maximumOrderAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    // =========================================================
    // USAGE
    // =========================================================
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },

    // =========================================================
    // VALIDITY
    // =========================================================
    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    // =========================================================
    // APPLICABILITY
    // =========================================================
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // =========================================================
    // STATUS
    // =========================================================
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Coupon ||
  mongoose.model("Coupon", couponSchema);