const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    
    customerCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    
    address: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    pincode: {
      type: String,
      trim: true,
      default: "",
    },


    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    totalOrders: {
      type: Number,
      default: 0,
    },

    totalPurchaseAmount: {
      type: Number,
      default: 0,
    },

    lastPurchaseDate: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);



// =========================================================
// EXPORT
// =========================================================

module.exports = mongoose.model("Customer", customerSchema);