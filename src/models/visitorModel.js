const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema(
  {
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    path: { type: String, default: "/", },
    guestId: { type: String, default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  {
    timestamps: true,
    collection: "visitors" // <-- Force exact collection name matching MongoDB Compass
  }
);

module.exports = mongoose.model("Visitor", visitorSchema);