// const mongoose = require("mongoose");

// const visitorSchema = new mongoose.Schema(
//   {
//     ipAddress: { type: String, default: "" },
//     userAgent: { type: String, default: "" },
//     path: { type: String, default: "/", },
//     guestId: { type: String, default: null, index: true },
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
//   },
//   {
//     timestamps: true,
//     collection: "visitors" // <-- Force exact collection name matching MongoDB Compass
//   }
// );

// module.exports = mongoose.model("Visitor", visitorSchema);


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
  adName: { type: String, default: "" },
  utmSource: { type: String, default: "" },
  utmMedium: { type: String, default: "" },
  utmCampaign: { type: String, default: "" },

  // Session Activity & Funnel
  path: { type: String, required: true }, // Landing / current page
  landingPage: { type: String, default: "/" },
  exitPage: { type: String, default: "" },
  pagesViewed: { type: Number, default: 1 },
  sessionDuration: { type: String, default: "00:00" }, // e.g. "03:42"
  productViews: { type: Number, default: 0 },
  addToCart: { type: String, enum: ["Yes", "No"], default: "No" },
  checkoutStarted: { type: String, enum: ["Yes", "No"], default: "No" },
  purchase: { type: String, enum: ["Yes", "No"], default: "No" },
  whatsappClick: { type: String, enum: ["Yes", "No"], default: "No" },
}, { timestamps: true });

module.exports = mongoose.model("Visitor", visitorSchema);