const User = require("../models/userModel");
const OTP = require("../models/OTPModel");

const generateToken = require("../utils/generateToken");
const otpService = require("../services/OTPService");

// ============================================================
// NORMALIZE MOBILE NUMBER
// ============================================================

const normalizeMobileNumber = (
  mobileNumber
) => {
  if (!mobileNumber) {
    return null;
  }

  return mobileNumber
    .toString()
    .replace(/\D/g, "")
    .slice(-10);
};

// ============================================================
// VALIDATE INDIAN MOBILE NUMBER
// ============================================================

const isValidMobileNumber = (
  mobileNumber
) => {
  return /^[6-9]\d{9}$/.test(
    mobileNumber
  );
};

// ============================================================
// SEND OTP
// ============================================================

exports.sendOTP = async (req, res) => {
  try {
    let { mobileNumber } = req.body;

    // ----------------------------------------------------------
    // 1. Required field
    // ----------------------------------------------------------

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Mobile number is required.",
      });
    }

    // ----------------------------------------------------------
    // 2. Normalize
    // ----------------------------------------------------------

    mobileNumber =
      normalizeMobileNumber(
        mobileNumber
      );

    // ----------------------------------------------------------
    // 3. Validate
    // ----------------------------------------------------------

    if (
      !isValidMobileNumber(
        mobileNumber
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid 10-digit mobile number.",
      });
    }

    // ----------------------------------------------------------
    // 4. Generate OTP
    // ----------------------------------------------------------

    const otpResult =
      await otpService.sendOTP({
        mobileNumber,
        purpose: "LOGIN",
      });

    // ----------------------------------------------------------
    // 5. Development response
    // ----------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "OTP generated successfully.",

      // Only development
      // ...(process.env.NODE_ENV !==
      //   "production" && {
      //   otp: otpResult.otp,
      //   expiresAt:
      //     otpResult.expiresAt,
      // }),
      otp: otpResult.loginOTP,
      expiresAt:
        otpResult.expiresAt,
    });
  } catch (error) {
    console.error(
      "SEND OTP CONTROLLER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to send OTP.",

      ...(process.env.NODE_ENV !==
        "production" && {
        error: error.message,
      }),
    });
  }
};

// ============================================================
// VERIFY OTP
// ============================================================

exports.verifyOTP = async (
  req,
  res
) => {
  try {
    let {
      mobileNumber,
      otp,
    } = req.body;

    // ----------------------------------------------------------
    // 1. Required fields
    // ----------------------------------------------------------

    if (
      !mobileNumber ||
      !otp
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Mobile number and OTP are required.",
      });
    }

    // ----------------------------------------------------------
    // 2. Normalize mobile
    // ----------------------------------------------------------

    mobileNumber =
      normalizeMobileNumber(
        mobileNumber
      );

    // ----------------------------------------------------------
    // 3. Validate mobile
    // ----------------------------------------------------------

    if (
      !isValidMobileNumber(
        mobileNumber
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid mobile number.",
      });
    }

    // ----------------------------------------------------------
    // 4. Normalize OTP
    // ----------------------------------------------------------

    otp = otp.toString().trim();

    // ----------------------------------------------------------
    // 5. Validate OTP format
    // ----------------------------------------------------------

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message:
          "OTP must be a 6-digit number.",
      });
    }

    // ----------------------------------------------------------
    // 6. Find latest active OTP
    // ----------------------------------------------------------

    const otpRecord =
      await OTP.findOne({
        mobileNumber,
        purpose: "LOGIN",
        isVerified: false,
      }).sort({
        createdAt: -1,
      });

    // ----------------------------------------------------------
    // DEBUG
    // ----------------------------------------------------------

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "        VERIFY OTP DEBUG"
    );
    console.log(
      "===================================="
    );
    console.log(
      "Mobile Number :",
      mobileNumber
    );
    console.log(
      "Entered OTP   :",
      otp
    );

    if (otpRecord) {
      console.log(
        "OTP ID        :",
        otpRecord._id
      );

      console.log(
        "Stored OTP    :",
        otpRecord.otp
      );

      console.log(
        "Purpose       :",
        otpRecord.purpose
      );

      console.log(
        "Expires At    :",
        otpRecord.expiresAt
      );

      console.log(
        "Attempts      :",
        otpRecord.attempts
      );

      console.log(
        "Max Attempts  :",
        otpRecord.maxAttempts
      );

      console.log(
        "Is Verified   :",
        otpRecord.isVerified
      );
    } else {
      console.log(
        "OTP Record    : NOT FOUND"
      );
    }

    console.log(
      "===================================="
    );
    console.log("");

    // ----------------------------------------------------------
    // 7. OTP not found
    // ----------------------------------------------------------

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message:
          "OTP not found or already used. Please request a new OTP.",
      });
    }

    // ----------------------------------------------------------
    // 8. Check expiry
    // ----------------------------------------------------------

    if (
      !otpRecord.expiresAt ||
      otpRecord.expiresAt <=
        new Date()
    ) {
      await OTP.findByIdAndDelete(
        otpRecord._id
      );

      return res.status(400).json({
        success: false,
        message:
          "OTP has expired. Please request a new OTP.",
      });
    }

    // ----------------------------------------------------------
    // 9. Check maximum attempts
    // ----------------------------------------------------------

    if (
      otpRecord.attempts >=
      otpRecord.maxAttempts
    ) {
      await OTP.findByIdAndDelete(
        otpRecord._id
      );

      return res.status(429).json({
        success: false,
        message:
          "Maximum OTP attempts exceeded. Please request a new OTP.",
      });
    }

    // ----------------------------------------------------------
    // 10. Compare OTP
    // ----------------------------------------------------------

    if (
      otpRecord.otp !== otp
    ) {
      otpRecord.attempts += 1;

      await otpRecord.save();

      const remainingAttempts =
        otpRecord.maxAttempts -
        otpRecord.attempts;

      // --------------------------------------------------------
      // Last attempt failed
      // --------------------------------------------------------

      if (
        remainingAttempts <= 0
      ) {
        await OTP.findByIdAndDelete(
          otpRecord._id
        );

        return res.status(429).json({
          success: false,
          message:
            "Maximum OTP attempts exceeded. Please request a new OTP.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
        remainingAttempts,
      });
    }

    // ----------------------------------------------------------
    // 11. Mark OTP verified
    // ----------------------------------------------------------

    otpRecord.isVerified = true;

    await otpRecord.save();

    // ----------------------------------------------------------
    // 12. Find existing user
    // ----------------------------------------------------------

    let user =
      await User.findOne({
        mobileNumber,
      });

    // ----------------------------------------------------------
    // 13. Create customer if not found
    // ----------------------------------------------------------

    if (!user) {
      user = await User.create({
        mobileNumber,

        role: "customer",

        isVerified: true,

        isActive: true,

        lastLoginAt: new Date(),
      });
    }

    // ----------------------------------------------------------
    // 14. Existing user
    // ----------------------------------------------------------

    else {
      // --------------------------------------------------------
      // Check active status
      // --------------------------------------------------------

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message:
            "Your account is inactive. Please contact support.",
        });
      }

      // --------------------------------------------------------
      // Update verification
      // --------------------------------------------------------

      user.isVerified = true;

      // --------------------------------------------------------
      // Update login time
      // --------------------------------------------------------

      user.lastLoginAt =
        new Date();

      await user.save();
    }

    // ----------------------------------------------------------
    // 15. Generate JWT
    // ----------------------------------------------------------

    const token =
      generateToken(user);

    // ----------------------------------------------------------
    // 16. Response
    // ----------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Login successful.",

      token,

      user: {
        id: user._id,

        name:
          user.name || null,

        mobileNumber:
          user.mobileNumber || null,

        email:
          user.email || null,

        role: user.role,

        profileImage:
          user.profileImage ||
          null,

        isVerified:
          user.isVerified,

        isActive:
          user.isActive,
      },
    });
  } catch (error) {
    console.error(
      "VERIFY OTP CONTROLLER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify OTP.",

      ...(process.env.NODE_ENV !==
        "production" && {
        error: error.message,
      }),
    });
  }
};

// ============================================================
// RESEND OTP
// ============================================================

exports.resendOTP = async (
  req,
  res
) => {
  try {
    let { mobileNumber } =
      req.body;

    // ----------------------------------------------------------
    // 1. Required
    // ----------------------------------------------------------

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Mobile number is required.",
      });
    }

    // ----------------------------------------------------------
    // 2. Normalize
    // ----------------------------------------------------------

    mobileNumber =
      normalizeMobileNumber(
        mobileNumber
      );

    // ----------------------------------------------------------
    // 3. Validate
    // ----------------------------------------------------------

    if (
      !isValidMobileNumber(
        mobileNumber
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid mobile number.",
      });
    }

    // ----------------------------------------------------------
    // 4. Generate new OTP
    // ----------------------------------------------------------

    const otpResult =
      await otpService.sendOTP({
        mobileNumber,
        purpose: "LOGIN",
      });

    // ----------------------------------------------------------
    // 5. Response
    // ----------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "OTP resent successfully.",

      ...(process.env.NODE_ENV !==
        "production" && {
        otp: otpResult.otp,
        expiresAt:
          otpResult.expiresAt,
      }),
    });
  } catch (error) {
    console.error(
      "RESEND OTP CONTROLLER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to resend OTP.",

      ...(process.env.NODE_ENV !==
        "production" && {
        error: error.message,
      }),
    });
  }
};