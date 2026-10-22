const express = require("express");
const router = express.Router();
const { getReports, exportReports } = require("../controllers/adminAnalyticsController");

router.get("/reports", getReports);
router.get("/export", exportReports);

module.exports = router;
