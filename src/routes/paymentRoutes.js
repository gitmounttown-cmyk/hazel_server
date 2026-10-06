const express = require("express");

const router =
  express.Router();

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  createOrder,
  verifyPayment,
} = require("../controllers/paymentController");

// =============================================================
// CREATE RAZORPAY ORDER
// =============================================================

router.post(
  "/create-order",
  verifyToken,
  createOrder
);

// =============================================================
// VERIFY RAZORPAY PAYMENT
// =============================================================

router.post(
  "/verify",
  verifyToken,
  verifyPayment
);

module.exports = router;