// const express = require("express");
// const router = express.Router();
// const jwt = require("jsonwebtoken");

// const {
//   checkServiceability,
//   manifestForwardOrder,
//   trackShipment,
//   trackByOrderNumber,
//   cancelShipment,
// } = require("../controllers/velocityController");

// const {
//   createOrder,
//   verifyPayment,
//   getPaymentByOrder,
// } = require("../controllers/paymentController");

// // Inline Authentication Middleware to guarantee a valid function handler
// const verifyToken = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;
    
//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Authentication required.",
//       });
//     }

//     const token = authHeader.split(" ")[1];
//     const decoded = jwt.verify(
//       token, 
//       process.env.JWT_SECRET || "your_jwt_secret"
//     );
    
//     req.user = decoded;
//     next();
//   } catch (error) {
//     return res.status(401).json({
//       success: false,
//       message: "Invalid or expired token.",
//     });
//   }
// };

// // ==========================================================
// // PAYMENT ROUTES (Mounted at /api/payments)
// // ==========================================================
// router.post("/create-order", verifyToken, createOrder);
// router.post("/verify-payment", verifyToken, verifyPayment);
// router.get("/order/:orderId", verifyToken, getPaymentByOrder);

// // ==========================================================
// // VELOCITY SHIPMENT & SERVICEABILITY ROUTES
// // ==========================================================
// router.post("/check-serviceability", checkServiceability);
// router.post("/manifest-order", manifestForwardOrder);
// router.get("/track/:awbCode", trackShipment);
// router.get("/track-by-order/:orderNumber", trackByOrderNumber);
// router.post("/cancel", cancelShipment);

// module.exports = router;
const express = require("express");
const router = express.Router();

const {
  createOrder,
  verifyPayment,
  getPaymentByOrder,
} = require("../controllers/paymentController");

const { verifyToken } = require("../middleware/authMiddleware");

// 1. CREATE RAZORPAY ORDER
router.post("/create-order", verifyToken, createOrder);

// 2. VERIFY RAZORPAY PAYMENT & MANIFEST VELOCITY SHIPMENT
router.post("/verify-payment", verifyToken, verifyPayment);

// 3. GET PAYMENT DETAILS BY ORDER ID
router.get("/order/:orderId", verifyToken, getPaymentByOrder);

module.exports = router;