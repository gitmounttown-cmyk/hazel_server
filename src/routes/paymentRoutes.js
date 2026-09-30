const express = require("express");
const router = express.Router();
const { createOrder, verifyPayment } = require("../controllers/paymentController");

// Endpoint to generate Razorpay order ID
router.post("/create-order", createOrder);

// Endpoint to verify checkout payment signature
router.post("/verify", verifyPayment);

module.exports = router;