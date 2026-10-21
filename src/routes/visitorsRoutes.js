const express = require("express");
const router = express.Router();
const visitorsController = require("../controllers/visitorsController"); // Adjust path if needed

// 1. Track live page visit (Public / Client-side route)
router.post("/track", visitorsController.trackVisit);

// 2. Get paginated visitor analytics logs for Admin Dashboard
router.get("/all", visitorsController.getVisitors);

// 3. Export visitor/session report as CSV based on date filters
router.get("/export", visitorsController.exportVisitorsCSV);

module.exports = router;