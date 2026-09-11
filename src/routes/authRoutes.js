const express = require("express");

const router = express.Router();

const {
  sendOTP,
  verifyOTP,
  resendOTP,
  googleSignIn, // 👈 Add this
  updateProfile,
  getMe,
  logout,
} = require("../controllers/authController");

const { verifyToken } = require("../middleware/authMiddleware");

// ============================================================
// SEND OTP
// ============================================================
router.post("/send-otp", sendOTP);

// ============================================================
// VERIFY OTP
// ============================================================
router.post("/verify-otp", verifyOTP);

// ============================================================
// RESEND OTP
// ============================================================
router.post("/resend-otp", resendOTP);

// ============================================================
// GOOGLE SIGN-IN
// ============================================================
router.post("/google", googleSignIn);

// ============================================================
// UPDATE PROFILE
// ============================================================
router.put("/profile", verifyToken, updateProfile);

// ============================================================
// CURRENT USER
// ============================================================
router.get("/me", verifyToken, getMe);

// ============================================================
// LOGOUT
// ============================================================
router.post("/logout", verifyToken, logout);

// ============================================================
// EXPORT
// ============================================================
module.exports = router;