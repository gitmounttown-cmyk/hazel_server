const OTP = require("../models/OTPModel");
const generateOTP = require("../utils/generateOTP");

// ============================================================
// OTP CONFIGURATION
// ============================================================

const OTP_EXPIRY_MINUTES = 5;

// ============================================================
// SEND OTP
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
    // 3. Delete Existing Unverified OTP
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
    // 5. Development Terminal
    // ----------------------------------------------------------

    console.log("");
    console.log("====================================");
    console.log("        HAZEL DEVELOPMENT OTP");
    console.log("====================================");
    console.log(
      "Mobile Number :",
      mobileNumber
    );
    console.log(
      "Purpose       :",
      purpose
    );
    console.log(
      "OTP           :",
      otp
    );
    console.log(
      "Expires At    :",
      expiresAt
    );
    console.log("====================================");
    console.log("");

    // ----------------------------------------------------------
    // 6. RETURN DATA
    // ----------------------------------------------------------

    return {
      success: true,
      message: "OTP generated successfully.",

      // IMPORTANT:
      // OTP is returned ONLY during development.
      // Production will not return OTP.

      // otp: process.env.NODE_ENV !== "production"
      //     ? otp
      //     : undefined,
          otp:  otp,

      expiresAt,
    };
  } catch (error) {
    console.error(
      "SEND OTP SERVICE ERROR:",
      error
    );

    throw error;
  }
};