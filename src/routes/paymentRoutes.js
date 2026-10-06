const express = require("express");

const router = express.Router();

const {
  createOrder,
  verifyPayment,
} = require("../controllers/paymentController");

// ============================================================
// CREATE RAZORPAY ORDER
// POST /api/payment/create-order
// ============================================================

router.post("/create-order", createOrder);

// ============================================================
// VERIFY RAZORPAY PAYMENT
// POST /api/payment/verify
// ============================================================

router.post("/verify", verifyPayment);

module.exports = router;