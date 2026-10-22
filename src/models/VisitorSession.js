const mongoose = require("mongoose");

const VisitorSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  visitorId: { type: String, required: true, index: true },
  startedAt: { type: Date, required: true, index: true },
  lastActivityAt: { type: Date, required: true, index: true },
  endedAt: { type: Date, default: null },
  isNewVisitor: { type: Boolean, default: true },
  country: { type: String, default: "Unknown" },
  state: { type: String, default: "Unknown" },
  city: { type: String, default: "Unknown" },
  deviceType: { type: String, default: "Unknown" },
  os: { type: String, default: "Unknown" },
  browser: { type: String, default: "Unknown" },
  trafficSource: { type: String, default: "direct", index: true },
  trafficMedium: { type: String, default: "none" },
  campaignName: { type: String, default: "" },
  adContent: { type: String, default: "" },
  utmSource: { type: String, default: "" },
  utmMedium: { type: String, default: "" },
  utmCampaign: { type: String, default: "" },
  utmContent: { type: String, default: "" },
  utmTerm: { type: String, default: "" },
  landingPage: { type: String, default: "/" },
  exitPage: { type: String, default: "/" },
  pagesViewed: { type: Number, default: 0 },
  productViewCount: { type: Number, default: 0 },
  addToCartCount: { type: Number, default: 0 },
  checkoutStarted: { type: Boolean, default: false },
  purchaseCompleted: { type: Boolean, default: false },
  purchaseCount: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  whatsappClickCount: { type: Number, default: 0 },
  searchCount: { type: Number, default: 0 },
  durationSeconds: { type: Number, default: 0 },
}, { timestamps: true });

const retentionDays = Math.max(1, Number(process.env.ANALYTICS_RETENTION_DAYS || 395));
// TTL is based on lastActivityAt. The session is removed after configured inactivity retention.
VisitorSessionSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: retentionDays * 86400 });

module.exports = mongoose.model("VisitorSession", VisitorSessionSchema);
