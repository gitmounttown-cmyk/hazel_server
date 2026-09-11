const express = require("express");

const router = express.Router();

const {
  createCashfreePayment,
  verifyCashfreePayment,
  cashfreeWebhook,
  getPaymentByOrder,
  getAllPayments,
  updatePaymentStatus,
  deletePayment,
} = require("../controllers/paymentController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

// ======================================================
// CASHFREE PAYMENT
// ======================================================

// Create Cashfree payment
router.post(
  "/create",
  verifyToken,
  createCashfreePayment
);

// Verify Cashfree payment
router.get(
  "/verify/:orderId",
  verifyToken,
  verifyCashfreePayment
);

// Cashfree webhook
// IMPORTANT: DO NOT USE verifyToken HERE
router.post(
  "/webhook",
  cashfreeWebhook
);

// ======================================================
// PAYMENT MANAGEMENT
// ======================================================

// Get payment by order
router.get(
  "/order/:orderId",
  verifyToken,
  getPaymentByOrder
);

// Get all payments
router.get(
  "/all",
  verifyToken,
  getAllPayments
);

// Update payment status
router.put(
  "/status/:paymentId",
  verifyToken,
  updatePaymentStatus
);

// Soft delete payment
router.delete(
  "/delete/:paymentId",
  verifyToken,
  deletePayment
);

module.exports = router;