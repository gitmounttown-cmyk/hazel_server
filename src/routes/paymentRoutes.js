const express = require("express");

const router =
  express.Router();

const {
  verifyToken, optionalAuth
} = require("../middleware/authMiddleware");

const authMiddleware = require("../middleware/authMiddleware");
const paymentController = require("../controllers/paymentController");

// Safely extract and fallback validate handlers to prevent startup crashes
// const verifyToken = authMiddleware?.verifyToken;
// const optionalAuth = authMiddleware?.optionalAuth;

const createOrder = paymentController?.createOrder;
const verifyPayment = paymentController?.verifyPayment;
const getPaymentByOrder = paymentController?.getPaymentByOrder;

// Validate that every handler is a valid function before passing to Express
[
  { name: "verifyToken", fn: verifyToken },
  { name: "optionalAuth", fn: optionalAuth },
  { name: "createOrder", fn: createOrder },
  { name: "verifyPayment", fn: verifyPayment },
  { name: "getPaymentByOrder", fn: getPaymentByOrder },
].forEach(({ name, fn }) => {
  if (typeof fn !== "function") {
    throw new Error(`[Route Error] Handler '${name}' is undefined or not a valid function. Check your exports/imports.`);
  }
});

// =============================================================
// 1. CREATE RAZORPAY ORDER (Supports optional/guest auth)
// =============================================================
router.post("/create-order", optionalAuth, createOrder);

// =============================================================
// 2. VERIFY RAZORPAY PAYMENT & MANIFEST VELOCITY SHIPMENT
// =============================================================
router.post("/verify-payment", optionalAuth, verifyPayment);
router.post("/verify", optionalAuth, verifyPayment);

// =============================================================
// 3. GET PAYMENT DETAILS BY ORDER ID
// =============================================================
// router.get("/order/:orderId", verifyToken, getPaymentByOrder);
router.get("/order/:orderId", optionalAuth, getPaymentByOrder);
module.exports = router;