const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // =========================================================
    // USER
    // =========================================================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =========================================================
    // ORDER NUMBER
    // =========================================================
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },

    // =========================================================
    // ORDER ITEMS
    // =========================================================
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OrderItem",
      },
    ],

    // =========================================================
    // SHIPPING ADDRESS SNAPSHOT
    // =========================================================
    shippingAddress: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      mobileNumber: {
        type: String,
        required: true,
        trim: true,
      },

      addressLine1: {
        type: String,
        required: true,
        trim: true,
      },

      addressLine2: {
        type: String,
        trim: true,
        default: "",
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      pincode: {
        type: String,
        required: true,
        trim: true,
      },

      country: {
        type: String,
        default: "India",
        trim: true,
      },
    },

    // =========================================================
    // PRICE DETAILS
    // =========================================================
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    shippingCharge: {
      type: Number,
      min: 0,
      default: 0,
    },

    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // =========================================================
    // COUPON
    // =========================================================
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    couponCode: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // PAYMENT
    // =========================================================
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      required: true,
      default: "COD",
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "PAID",
        "FAILED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
      ],
      default: "PENDING",
    },

    // =========================================================
    // ORDER STATUS
    // =========================================================
    orderStatus: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "RETURN_REQUESTED",
        "RETURNED",
        "REFUND_REQUESTED",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },

    // =========================================================
    // DELIVERY
    // =========================================================
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // TRACKING
    // =========================================================
    courierName: {
      type: String,
      trim: true,
      default: "",
    },

    trackingNumber: {
      type: String,
      trim: true,
      default: "",
    },

    trackingUrl: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // NOTES
    // =========================================================
    customerNote: {
      type: String,
      trim: true,
      default: "",
    },

    adminNote: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================
    // SOFT DELETE
    // =========================================================
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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

// =============================================================
// ORDER NUMBER
// =============================================================

orderSchema.pre("save", async function (s) {
  if (!this.isNew || this.orderNumber) {
    return ;
  }

  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);

  this.orderNumber = `HZL-${timestamp}-${random}`;


});

module.exports =
  mongoose.models.Order || mongoose.model("Order", orderSchema);