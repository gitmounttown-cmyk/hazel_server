const express = require("express");

const router = express.Router();

const {
  sendOTP,
  verifyOTP,
  resendOTP,
} = require("../controllers/authController");
const { uploadProfileImage } = require("../middleware/uploadMiddleware");
const { verifyToken } = require("../middleware/authMiddleware");

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

// ============================================================
// GOOGLE SIGN-IN
// ============================================================
router.post("/google", googleSignIn);

// ============================================================
// UPDATE PROFILE
// ============================================================
router.put(
  "/profile",
  verifyToken,
  uploadProfileImage.single("profileImage"),
  updateProfile,
);
// ============================================================
// CURRENT USER
// ============================================================
router.get("/me", verifyToken, getMe);

// ============================================================
// LOGOUT
// ============================================================
router.post("/logout", verifyToken, logout);
router.post(
  "/resend-otp",
  resendOTP
);

// ============================================================
// EXPORT
// ============================================================
module.exports = router;

module.exports = router;
