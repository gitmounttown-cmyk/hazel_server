const Visitor = require("../models/visitorModel");
const jwt = require("jsonwebtoken");

// Track page visit supporting both userId and guestId
exports.trackVisit = async (req, res) => {
  try {
    const { path, guestId } = req.body;
    
    let userId = null;

    // Extract and verify token from headers to dynamically find logged-in user
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded._id || decoded.userId || null;
      } catch (err) {
        userId = null; // Invalid or expired token, fallback to guest tracking
      }
    }
    
    const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    // Save visit log linking path, guestId, and resolved userId
    await Visitor.create({
      ipAddress,
      userAgent,
      path: path || "/",
      guestId: guestId || null,
      userId: userId || null,
    });

    const totalVisits = await Visitor.countDocuments();
    const uniqueVisitors = await Visitor.distinct("ipAddress").then((ips) => ips.length);
    const uniqueGuests = await Visitor.distinct("guestId").then((guests) => guests.filter(Boolean).length);

    // FIX: Changed from 500 to 200 so successful tracking returns proper status
    return res.status(200).json({
      success: true,
      totalVisits,
      uniqueVisitors,
      uniqueGuests,
    });
  } catch (error) {
    console.error("TRACK VISIT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to track visit.",
    });
  }
};

// Fetch all logs for Admin Dashboard
exports.getVisitors = async (req, res) => {
  try {
    const totalVisits = await Visitor.countDocuments();
    const uniqueVisitors = await Visitor.distinct("ipAddress").then((ips) => ips.length);
    const uniqueGuests = await Visitor.distinct("guestId").then((guests) => guests.filter(Boolean).length);

    const visitors = await Visitor.find()
      .populate("userId", "name mobileNumber email") // Populate user details for friendly name display
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      stats: {
        totalVisits,
        uniqueVisitors,
        uniqueGuests,
      },
      visitors,
    });
  } catch (error) {
    console.error("GET VISITORS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch visitor logs.",
    });
  }
};