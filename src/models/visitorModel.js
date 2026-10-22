const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  guestId: { type: String, index: true }, // Visitor ID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  isReturning: { type: Boolean, default: false },
  
  // Location & Environment
  country: { type: String, default: "India" },
  state: { type: String, default: "Tamil Nadu" },
  city: { type: String, default: "Coimbatore" },
  device: { type: String, default: "Mobile" },
  os: { type: String, default: "Android" },
  browser: { type: String, default: "Chrome" },
  ipAddress: { type: String },
  userAgent: { type: String },

  // Traffic & Campaigns
  trafficSource: { type: String, default: "Direct" },
  trafficMedium: { type: String, default: "None" },
  campaignName: { type: String, default: "" },
  utmSource: { type: String, default: "" },
  utmMedium: { type: String, default: "" },
  utmCampaign: { type: String, default: "" },

  // Session Activity, Funnel & Advanced Reports
  path: { type: String, required: true },
  landingPage: { type: String, default: "/" },
  exitPage: { type: String, default: "" },
  pagesViewed: { type: Number, default: 1 },
  sessionDuration: { type: String, default: "00:00" }, // e.g., "03:42"
  
  // Specific feature tracking
  searchQuery: { type: String, default: "" }, // Product Search Report
  productViews: { type: Number, default: 0 },   // Product Performance Report
  productName: { type: String, default: "" },  // Viewed or interacted product name
  addToCart: { type: String, enum: ["Yes", "No"], default: "No" },
  checkoutStarted: { type: String, enum: ["Yes", "No"], default: "No" },
  purchase: { type: String, enum: ["Yes", "No"], default: "No" }, // Purchase tracking
  whatsappClick: { type: String, enum: ["Yes", "No"], default: "No" },
  customerJourneyStage: { type: String, default: "Discovery" }, // Customer Journey / Funnel
}, { timestamps: true });

module.exports = mongoose.model("Visitor", visitorSchema);