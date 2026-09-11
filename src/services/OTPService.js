const OTP = require("../models/OTPModel");
const generateOTP = require("../utils/generateOTP");

// ============================================================
// OTP CONFIGURATION
// ============================================================

const OTP_EXPIRY_MINUTES = 5;

// ============================================================
// SEND OTP - DEVELOPMENT VERSION
// ============================================================

exports.sendOTP = async ({
  mobileNumber,
  purpose = "LOGIN",
}) => {
  try {
    // ----------------------------------------------------------
    // 1. Generate OTP
    // ----------------------------------------------------------

    const otp = generateOTP();

    // ----------------------------------------------------------
    // 2. Calculate Expiry
    // ----------------------------------------------------------

    const expiresAt = new Date(
      Date.now() +
        OTP_EXPIRY_MINUTES * 60 * 1000
    );

    // ----------------------------------------------------------
    // 3. Delete Existing OTP
    // ----------------------------------------------------------

    await OTP.deleteMany({
      mobileNumber,
      purpose,
      isVerified: false,
    });

    // ----------------------------------------------------------
    // 4. Create New OTP
    // ----------------------------------------------------------

    await OTP.create({
      mobileNumber,
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      isVerified: false,
    });

    // ----------------------------------------------------------
    // 5. DEVELOPMENT ONLY
    // ----------------------------------------------------------

    console.log("====================================");
    console.log("        HAZEL DEVELOPMENT OTP");
    console.log("====================================");
    console.log("Mobile Number :", mobileNumber);
    console.log("Purpose       :", purpose);
    console.log("OTP           :", otp);
    console.log("Expires At    :", expiresAt);
    console.log("====================================");

    return {
      success: true,
      message: "OTP generated successfully",
    };
  } catch (error) {
    console.error(
      "SEND OTP SERVICE ERROR:",
      error
    );

    throw error;
  }
};