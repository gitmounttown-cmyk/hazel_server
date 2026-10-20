const express = require("express");
const router = express.Router();
const { trackVisit, getVisitors } = require("../controllers/visitorsController");
// const authMiddleware = require("../middlewares/authMiddleware"); // Optional if you use token verification

// Public route to log page visits (passes token in headers if logged in)
router.post("/track", trackVisit);

// Admin route to fetch visitor analytics and logs
router.get("/all", getVisitors);

module.exports = router;