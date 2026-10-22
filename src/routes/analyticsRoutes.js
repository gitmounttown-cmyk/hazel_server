const express = require("express");
const router = express.Router();
const { collectEvent } = require("../controllers/analyticsController");

// Add rate limiting / bot filtering from your existing middleware if available.
router.post("/event", express.json({ limit: "32kb" }), collectEvent);

module.exports = router;
