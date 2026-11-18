const express = require("express");
const router = express.Router();
const { sendOTP, verifyOTP, resendOTP, getMe } = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
//get me details
router.get("/me", verifyToken, getMe);

module.exports = router;