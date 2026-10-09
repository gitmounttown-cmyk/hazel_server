const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // =========================================================
    // USER
    // =========================================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },

    // =========================================================
    // GUEST
    // =========================================================
    guestId: {
      type: String,
      default: null,
      index: true,
    },

    // =========================================================
    // HAZEL ECOMMERCE ORDER
    // =========================================================
    ecommerceOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    // =========================================================
    // RAZORPAY ORDER ID
    // =========================================================
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // =========================================================
    // RAZORPAY PAYMENT ID
    // =========================================================
    razorpayPaymentId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },

    // =========================================================
    // RAZORPAY SIGNATURE
    // =========================================================
    signature: {
      type: String,
      default: null,
    },

    // =========================================================
    // AMOUNT
    // =========================================================
    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    // =========================================================
    // PAYMENT STATUS
    // =========================================================
    status: {
      type: String,
      enum: [
        "created",
        "paid",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "created",
      index: true,
    },

    // =========================================================
    // RECEIPT
    // =========================================================
    receipt: {
      type: String,
      required: true,
    },

    // =========================================================
    // REFUND
    // =========================================================
    refundId: {
      type: String,
      default: null,
    },

    refundAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);