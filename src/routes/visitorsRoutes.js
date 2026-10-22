const express = require("express");
const router = express.Router();
const visitorsController = require("../controllers/visitorsController");

router.post("/track", visitorsController.trackVisit);
router.get("/all", visitorsController.getVisitors);
router.get("/export", visitorsController.exportVisitorsCSV);

module.exports = router;