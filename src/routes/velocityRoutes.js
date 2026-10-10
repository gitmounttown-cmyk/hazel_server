// const express = require("express");
// const router = express.Router();

// const {
//   checkServiceability,
//   manifestForwardOrder,
//   trackShipment,
//   cancelShipment,
// } = require("../controllers/velocityController");

// const { verifyToken } = require("../middleware/authMiddleware");

// // Check serviceability by pincodes
// router.post("/check-serviceability", verifyToken, checkServiceability);

// // Manifest forward shipment directly with provided order payload
// router.post("/manifest-order", verifyToken, manifestForwardOrder);

// // Track shipment via AWB code
// router.get("/track/:awbCode", verifyToken, trackShipment);

// // Cancel shipment via AWB code
// router.post("/cancel", verifyToken, cancelShipment);

// module.exports = router;



const express = require("express");
const router = express.Router();

const {
  checkServiceability,
  manifestForwardOrder,
  trackShipment,
  cancelShipment,
} = require("../controllers/velocityController");

const { verifyToken, optionalAuth } = require("../middleware/authMiddleware");

// ==========================================================
// VELOCITY ROUTES
// ==========================================================

// Changed from verifyToken to optionalAuth to support both logged-in and guest users seamlessly
router.post("/check-serviceability", optionalAuth, checkServiceability);

// Manifest forward shipment directly with provided order payload
router.post("/manifest-order", verifyToken, manifestForwardOrder);

// Track shipment via AWB code
router.get("/track/:awbCode", verifyToken, trackShipment);

// Cancel shipment via AWB code
router.post("/cancel", verifyToken, cancelShipment);

module.exports = router;