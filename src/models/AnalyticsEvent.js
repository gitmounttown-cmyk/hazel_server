const mongoose = require("mongoose");

const AnalyticsEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventName: { type: String, required: true, index: true },
  occurredAt: { type: Date, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  visitorId: { type: String, required: true, index: true },
  path: { type: String, default: "/" },
  referrer: { type: String, default: "" },
  productId: { type: String, default: "", index: true },
  productName: { type: String, default: "" },
  sku: { type: String, default: "" },
  category: { type: String, default: "" },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: "INR" },
  orderId: { type: String, default: "", index: true },
  searchQuery: { type: String, default: "" },
  resultsCount: { type: Number, default: null },
  campaign: { type: String, default: "" },
  source: { type: String, default: "direct" },
  medium: { type: String, default: "none" },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

AnalyticsEventSchema.index({ occurredAt: 1, eventName: 1 });
AnalyticsEventSchema.index({ productId: 1, occurredAt: 1 });

module.exports = mongoose.model("AnalyticsEvent", AnalyticsEventSchema);
