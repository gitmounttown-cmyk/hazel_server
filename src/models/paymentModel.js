const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    // Razorpay Order ID
    orderId: {
      type: String,
      required: true,
      unique: true,
    },

    // Razorpay Payment ID
    paymentId: {
      type: String,
      default: null,
    },

    // Razorpay payment signature
    signature: {
      type: String,
      default: null,
    },

    // Customer-facing amount in INR
    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },

    receipt: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payment", paymentSchema);