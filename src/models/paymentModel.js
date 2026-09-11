const mongoose = require("mongoose");

// ============================================================
// PAYMENT SCHEMA
// ============================================================

const paymentSchema = new mongoose.Schema(
  {
    // ==========================================================
    // ORDER
    // ==========================================================

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    // ==========================================================
    // USER
    // ==========================================================

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==========================================================
    // INTERNAL PAYMENT ID
    // ==========================================================

    paymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },

    // ==========================================================
    // TRANSACTION ID
    // ==========================================================

    transactionId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    // ==========================================================
    // CASHFREE ORDER ID
    // ==========================================================

    gatewayOrderId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    // ==========================================================
    // CASHFREE PAYMENT ID
    // ==========================================================

    gatewayPaymentId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    // ==========================================================
    // CASHFREE PAYMENT SESSION ID
    // ==========================================================

    paymentSessionId: {
      type: String,
      default: "",
      trim: true,
    },

    // ==========================================================
    // PAYMENT GATEWAY
    // ==========================================================

    gateway: {
      type: String,
      enum: [
        "CASHFREE",
        "RAZORPAY",
        "STRIPE",
        "OTHER",
        "COD",
      ],
      default: "COD",
      index: true,
    },

    // ==========================================================
    // AMOUNT
    // ==========================================================

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ==========================================================
    // CURRENCY
    // ==========================================================

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    // ==========================================================
    // PAYMENT METHOD
    // ==========================================================

    paymentMethod: {
      type: String,
      enum: [
        "COD",
        "UPI",
        "CARD",
        "NET_BANKING",
        "WALLET",
        "EMI",
        "OTHER",
      ],
      required: true,
    },

    // ==========================================================
    // PAYMENT STATUS
    // ==========================================================

    status: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },

    // ==========================================================
    // FAILURE REASON
    // ==========================================================

    failureReason: {
      type: String,
      default: "",
      trim: true,
    },

    // ==========================================================
    // PAID DATE
    // ==========================================================

    paidAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // REFUND DATE
    // ==========================================================

    refundedAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // REFUND AMOUNT
    // ==========================================================

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================================
    // CASHFREE RESPONSE
    // ==========================================================

    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ==========================================================
    // SOFT DELETE
    // ==========================================================

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

paymentSchema.index({
  orderId: 1,
  userId: 1,
});

paymentSchema.index({
  gatewayOrderId: 1,
  gateway: 1,
});

paymentSchema.index({
  status: 1,
  createdAt: -1,
});

// ============================================================
// EXPORT
// ============================================================

module.exports =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);