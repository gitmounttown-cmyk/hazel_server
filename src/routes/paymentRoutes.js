const express = require("express");

const router =
  express.Router();

const {
  verifyToken, optionalAuth
} = require("../middleware/authMiddleware");

const {
  createOrder,
  verifyPayment,
} = require("../controllers/paymentController");

// =============================================================
// CREATE RAZORPAY ORDER
// =============================================================

// router.post(
//   "/create-order",
//   verifyToken,
//   createOrder
// );
router.post("/create-order",  optionalAuth,  createOrder);

// =============================================================
// VERIFY RAZORPAY PAYMENT
// =============================================================

// router.post(
//   "/verify",
//   verifyToken,
//   verifyPayment
// );

router.post(
  "/verify",
  optionalAuth,
  verifyPayment
);

module.exports = router;