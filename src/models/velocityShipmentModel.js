const mongoose = require("mongoose");

const velocityShipmentSchema = new mongoose.Schema(
  {
    // Local reference or external order identifier string
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    velocityOrderId: {
      type: String,
      trim: true,
    },
    shipmentId: {
      type: String,
      trim: true,
    },
    awbCode: {
      type: String,
      trim: true,
      index: true,
    },
    courierCompanyId: {
      type: String,
      trim: true,
    },
    courierName: {
      type: String,
      trim: true,
    },
    labelUrl: {
      type: String,
      trim: true,
    },
    manifestUrl: {
      type: String,
      trim: true,
    },
    shipmentType: {
      type: String,
      enum: ["FORWARD", "REVERSE"],
      default: "FORWARD",
    },
    status: {
      type: String,
      default: "MANIFESTED",
    },
    shippingAddress: {
      name: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },
    packageDetails: {
      length: Number,
      breadth: Number,
      height: Number,
      weight: Number,
    },
    charges: {
      shippingCharges: Number,
      codCharges: Number,
      rtoCharges: Number,
    },
    trackingHistory: [
      {
        date: String,
        activity: String,
        location: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.VelocityShipment ||
  mongoose.model("VelocityShipment", velocityShipmentSchema);