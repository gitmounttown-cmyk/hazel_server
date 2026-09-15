const express = require("express");

const router = express.Router();

const {
  sendOTP,
  verifyOTP,
  resendOTP,
} = require("../controllers/authController");

// ============================================================
// SEND OTP
// ============================================================

router.post(
  "/send-otp",
  sendOTP
);

// ============================================================
// VERIFY OTP
// ============================================================

router.post(
  "/verify-otp",
  verifyOTP
);

// ============================================================
// RESEND OTP
// ============================================================

router.post(
  "/resend-otp",
  resendOTP
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;