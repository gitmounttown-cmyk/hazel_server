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

// Fetch logs for Admin Dashboard with Pagination support
exports.getVisitors = async (req, res) => {
  try {
    // Read query parameters for pagination (defaults to page 1, limit 20)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const totalVisits = await Visitor.countDocuments();
    const uniqueVisitors = await Visitor.distinct("ipAddress").then((ips) => ips.length);
    const uniqueGuests = await Visitor.distinct("guestId").then((guests) => guests.filter(Boolean).length);

    const totalLogs = await Visitor.countDocuments();
    
    // Fetch paginated visitor records
    const visitors = await Visitor.find()
      .populate("userId", "name mobileNumber email") // Populate user details for friendly name display
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      stats: {
        totalVisits,
        uniqueVisitors,
        uniqueGuests,
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLogs / limit),
        totalLogs,
        limit,
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