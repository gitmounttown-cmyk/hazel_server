

// const express = require("express");
// const router = express.Router();

// const {
//   checkServiceability,
//   manifestForwardOrder,
//   trackShipment,
//   cancelShipment,
//   trackGuestOrder,
//   trackUserOrder,
// } = require("../controllers/velocityController");

// const { verifyToken, optionalAuth } = require("../middleware/authMiddleware");

// // ==========================================================
// // VELOCITY ROUTES
// // ==========================================================

// // Check serviceability by pincodes
// router.post("/check-serviceability", optionalAuth, checkServiceability);

// // Guest Order Tracking Route (Matching frontend /track-order call)
// router.post("/track-order", optionalAuth, trackGuestOrder);

// // Logged-in User Order Tracking by Order Number
// router.get("/track-by-order/:orderNumber", optionalAuth, trackUserOrder);
// // Logged-in User Order Tracking by Order Number
// router.get("/track-by-order/:orderNumber", optionalAuth, trackUserOrder);
// // Manifest forward shipment directly with provided order payload
// router.post("/manifest-order", verifyToken, manifestForwardOrder);

// // Track shipment via AWB code
// router.get("/track/:awbCode", verifyToken, trackShipment);

// // Cancel shipment via AWB code
// router.post("/cancel", verifyToken, cancelShipment);

// module.exports = router;


// const express = require("express");
// const router = express.Router();

// const {
//   checkServiceability,
//   manifestForwardOrder,
//   trackShipment,
//   cancelShipment,
//   trackGuestOrder,
//   trackUserOrder,
// } = require("../controllers/velocityController");

// const { verifyToken, optionalAuth } = require("../middleware/authMiddleware");

// // ==========================================================
// // VELOCITY ROUTES
// // ==========================================================

// // Check serviceability by pincodes
// router.post("/check-serviceability", optionalAuth, checkServiceability);

// // Guest Order Tracking Route
// router.post("/track-order", optionalAuth, trackGuestOrder);

// // Logged-in User Order Tracking by Order Number
// router.get("/track-by-order/:orderNumber", optionalAuth, trackUserOrder);

// // Manifest forward shipment directly with provided order payload
// router.post("/manifest-order", verifyToken, manifestForwardOrder);

// // Track shipment via AWB code
// router.get("/track/:awbCode", verifyToken, trackShipment);

// // Cancel shipment via AWB code
// router.post("/cancel", verifyToken, cancelShipment);

const express = require("express");
const router = express.Router();

const {
  checkServiceability,
  manifestForwardOrder,
  trackShipment,
  cancelShipment,
  trackGuestOrder,
  trackUserOrder,
} = require("../controllers/velocityController");

const { verifyToken, optionalAuth } = require("../middleware/authMiddleware");

// Routes
router.post("/check-serviceability", optionalAuth, checkServiceability);
router.post("/track-order", optionalAuth, trackGuestOrder);
router.get("/track-by-order/:orderNumber", optionalAuth, trackUserOrder);
router.post("/manifest-order", verifyToken, manifestForwardOrder);
router.get("/track/:awbCode", verifyToken, trackShipment);
router.post("/cancel", verifyToken, cancelShipment);

module.exports = router;