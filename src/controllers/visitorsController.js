const Visitor = require("../models/visitorModel");
const jwt = require("jsonwebtoken");

// Track or update session visit with full funnel & search metrics
exports.trackVisit = async (req, res) => {
  try {
    const { 
      sessionId, guestId, path, trafficSource, trafficMedium, 
      campaignName, utmSource, utmMedium, utmCampaign,
      device, os, browser, searchQuery, productViews, productName, 
      addToCart, checkoutStarted, purchase, whatsappClick, pagesViewed, sessionDuration 
    } = req.body;
    
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded._id || decoded.userId || null;
      } catch (err) {
        userId = null;
      }
    }
    
    const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    const existingSession = await Visitor.findOne({ sessionId: sessionId || guestId });
    const isReturning = !!existingSession;

    // Determine Customer Journey Stage based on interactions
    let journeyStage = "Discovery";
    if (searchQuery) journeyStage = "Search";
    else if (productViews > 0 || productName) journeyStage = "Product Consideration";
    else if (addToCart === "Yes") journeyStage = "Add to Cart";
    else if (checkoutStarted === "Yes") journeyStage = "Checkout Started";
    else if (purchase === "Yes") journeyStage = "Purchased";

    const newLog = await Visitor.create({
      sessionId: sessionId || guestId || "SES_DEFAULT",
      guestId: guestId || null,
      userId: userId || null,
      isReturning,
      ipAddress,
      userAgent,
      path: path || "/",
      landingPage: existingSession ? existingSession.landingPage : (path || "/"),
      trafficSource: trafficSource || "Direct",
      trafficMedium: trafficMedium || "None",
      campaignName: campaignName || "",
      utmSource: utmSource || "",
      utmMedium: utmMedium || "",
      utmCampaign: utmCampaign || "",
      device: device || "Mobile",
      os: os || "Android",
      browser: browser || "Chrome",
      searchQuery: searchQuery || "",
      productViews: productViews || 0,
      productName: productName || "",
      addToCart: addToCart || "No",
      checkoutStarted: checkoutStarted || "No",
      purchase: purchase || "No",
      whatsappClick: whatsappClick || "No",
      pagesViewed: pagesViewed || 1,
      sessionDuration: sessionDuration || "00:00",
      customerJourneyStage: journeyStage,
    });

    return res.status(200).json({ success: true, log: newLog });
  } catch (error) {
    console.error("TRACK VISIT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to track visit." });
  }
};

// Fetch paginated logs with Date Range Filtering
exports.getVisitors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { startDate, endDate } = req.query;

    let query = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start,$lte: end };
    }

    const totalVisits = await Visitor.countDocuments(query);
    const uniqueVisitors = await Visitor.distinct("guestId", query).then((guests) => guests.filter(Boolean).length);

    const visitors = await Visitor.find(query)
      .populate("userId", "name mobileNumber email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      stats: { totalVisits, uniqueVisitors, uniqueGuests: uniqueVisitors },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalVisits / limit) || 1,
        totalLogs: totalVisits,
        limit,
      },
      visitors,
    });
  } catch (error) {
    console.error("GET VISITORS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch visitor logs." });
  }
};

// Export Full Comprehensive CSV Report including Journey, Search, Products, Purchases, and Duration
exports.exportVisitorsCSV = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start,$lte: end };
    }

    const visitors = await Visitor.find(query)
      .populate("userId", "name mobileNumber email")
      .sort({ createdAt: -1 });

    let csvRows = [];
    csvRows.push([
      "Date", "Time", "Session ID", "Visitor ID", "User Name", "New/Returning", 
      "Device", "Browser", "Traffic Source", "Customer Journey", 
      "Search Query", "Product Performance", "Pages Viewed", "Session Duration", 
      "Add to Cart", "Purchase", "WhatsApp Click"
    ].join(","));

    visitors.forEach((v) => {
      const dateObj = new Date(v.createdAt);
      const userName = v.userId ? (v.userId.name || v.userId.mobileNumber || "Registered User") : "Guest";

      const row = [
        `"${dateObj.toLocaleDateString()}"`,
        `"${dateObj.toLocaleTimeString()}"`,
        `"${v.sessionId || ''}"`,
        `"${v.guestId || 'N/A'}"`,
        `"${userName}"`,
        `"${v.isReturning ? 'Returning' : 'New'}"`,
        `"${v.device || 'Mobile'}"`,
        `"${v.browser || 'Chrome'}"`,
        `"${v.trafficSource || 'Direct'}"`,
        `"${v.customerJourneyStage || 'Discovery'}"`,
        `"${v.searchQuery || 'None'}"`,
        `"${v.productName || 'N/A'} (Views: ${v.productViews})"`,
        `"${v.pagesViewed || 1}"`,
        `"${v.sessionDuration || '00:00'}"`,
        `"${v.addToCart || 'No'}"`,
        `"${v.purchase || 'No'}"`,
        `"${v.whatsappClick || 'No'}"`
      ];
      csvRows.push(row.join(","));
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=Visitor_Comprehensive_Report.csv`);
    return res.status(200).send(csvRows.join("\n"));
  } catch (error) {
    console.error("EXPORT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to export report." });
  }
};