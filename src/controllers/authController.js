const User = require("../models/userModel");
const OTP = require("../models/OTPModel");
const generateToken = require("../utils/generateToken");
const otpService = require("../services/OTPService");

const normalizeMobileNumber = (mobileNumber) => {
  if (!mobileNumber) return null;
  return mobileNumber.toString().replace(/\D/g, "").slice(-10);
};

const isValidMobileNumber = (mobileNumber) => {
  return /^[6-9]\d{9}$/.test(mobileNumber);
};

exports.sendOTP = async (req, res) => {
  try {
    let { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ success: false, message: "Mobile number is required." });
    }

    mobileNumber = normalizeMobileNumber(mobileNumber);

    if (!isValidMobileNumber(mobileNumber)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number." });
    }

    const otpResult = await otpService.sendOTP({ mobileNumber, purpose: "LOGIN" });

    return res.status(200).json({
      success: true,
      message: otpResult.message || "OTP sent successfully.",
      expiresAt: otpResult.expiresAt,
    });
  } catch (error) {
    console.error("SEND OTP CONTROLLER ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to send OTP." });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    let { mobileNumber, otp } = req.body;

    if (!mobileNumber || !otp) {
      return res.status(400).json({ success: false, message: "Mobile number and OTP are required." });
    }

    mobileNumber = normalizeMobileNumber(mobileNumber);

    if (!isValidMobileNumber(mobileNumber)) {
      return res.status(400).json({ success: false, message: "Please enter a valid mobile number." });
    }

    otp = otp.toString().trim();

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: "OTP must be a 6-digit number." });
    }

    const otpRecord = await OTP.findOne({
      mobileNumber,
      purpose: { $in: ["LOGIN", "RESEND_OTP"] },
      isVerified: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "OTP not found or already used. Please request a new OTP." });
    }

    if (!otpRecord.expiresAt || otpRecord.expiresAt <= new Date()) {
      await OTP.findByIdAndDelete(otpRecord._id);
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new OTP." });
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await OTP.findByIdAndDelete(otpRecord._id);
      return res.status(429).json({ success: false, message: "Maximum OTP attempts exceeded. Please request a new OTP." });
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;

      if (remainingAttempts <= 0) {
        await OTP.findByIdAndDelete(otpRecord._id);
        return res.status(429).json({ success: false, message: "Maximum OTP attempts exceeded. Please request a new OTP." });
      }

      return res.status(400).json({ success: false, message: "Invalid OTP.", remainingAttempts });
    }

    otpRecord.isVerified = true;
    await otpRecord.save();

    let user = await User.findOne({ mobileNumber });

    if (!user) {
      user = await User.create({
        mobileNumber,
        role: "customer",
        isVerified: true,
        isActive: true,
        lastLoginAt: new Date(),
      });
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: "Your account is inactive. Please contact support." });
      }

      user.isVerified = true;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name || null,
        mobileNumber: user.mobileNumber || null,
        email: user.email || null,
        role: user.role,
        profileImage: user.profileImage || null,
        isVerified: user.isVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("VERIFY OTP CONTROLLER ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to verify OTP." });
  }
};

exports.resendOTP = async (req, res) => {
  try {
    let { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ success: false, message: "Mobile number is required." });
    }

    mobileNumber = normalizeMobileNumber(mobileNumber);

    if (!isValidMobileNumber(mobileNumber)) {
      return res.status(400).json({ success: false, message: "Please enter a valid mobile number." });
    }

    await otpService.sendOTP({ mobileNumber, purpose: "RESEND_OTP" });

    return res.status(200).json({ success: true, message: "OTP resent successfully via SMS." });
  } catch (error) {
    console.error("RESEND OTP CONTROLLER ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to resend OTP." });
  }
};