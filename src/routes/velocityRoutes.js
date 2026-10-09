const express = require("express");
const router = express.Router();

const {
  checkServiceability,
  manifestForwardOrder,
  trackShipment,
  trackByOrderNumber,
  cancelShipment,
} = require("../controllers/velocityController");

const { verifyToken } = require("../middleware/authMiddleware");

// Check serviceability by pincodes
// POST /api/velocity/check-serviceability
router.post("/check-serviceability", verifyToken, checkServiceability);

// Manifest forward shipment directly with provided order payload
// POST /api/velocity/manifest-order
router.post("/manifest-order", verifyToken, manifestForwardOrder);

// Track shipment via AWB code
// GET /api/velocity/track/:awbCode
router.get("/track/:awbCode", verifyToken, trackShipment);

// Track shipment via Order Number (Used by AccountOverview.jsx)
// GET /api/velocity/track-by-order/:orderNumber
router.get("/track-by-order/:orderNumber", verifyToken, trackByOrderNumber);

// Cancel shipment via AWB code
// POST /api/velocity/cancel
router.post("/cancel", verifyToken, cancelShipment);

module.exports = router;