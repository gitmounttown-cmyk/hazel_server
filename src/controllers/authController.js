const User = require("../models/userModel");
const OTP = require("../models/OTPModel");

const generateToken = require("../utils/generateToken");
const otpService = require("../services/OTPService");

// ============================================================
// GOOGLE CLIENT
// ============================================================

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// // ============================================================
// // GENERATE JWT
// // ============================================================

// const generateToken = (user) => {
//   return jwt.sign(
//     {
//       id: user._id,
//       role: user.role,
//       mobileNumber: user.mobileNumber || null,
//       email: user.email || null,
//     },
//     process.env.JWT_SECRET,
//     {
//       expiresIn: "7d",
//     }
//   );
// };

// ============================================================
// NORMALIZE MOBILE NUMBER
// ============================================================

const normalizeMobileNumber = (
  mobileNumber
) => {
  if (!mobileNumber) {
    return null;
  }

  return mobileNumber.toString().replace(/\D/g, "").slice(-10);
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
      ...(process.env.NODE_ENV !==
        "production" && {
        otp: otpResult.otp,
        expiresAt:
          otpResult.expiresAt,
      }),
    });
  } catch (error) {
    console.error(
      "SEND OTP CONTROLLER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to send OTP.",
      error:
        process.env.NODE_ENV !== "production"
          ? error.message
          : undefined,
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
      otpRecord.expiresAt <= new Date()
    ) {
      await OTP.findByIdAndDelete(otpRecord._id);

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
      await OTP.findByIdAndDelete(otpRecord._id);

      return res.status(429).json({
        success: false,
        message: "Maximum OTP attempts exceeded. Please request a new OTP.",
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

      const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;

      // Delete OTP after last failed attempt
      if (remainingAttempts <= 0) {
        await OTP.findByIdAndDelete(
          otpRecord._id
        );

        return res.status(429).json({
          success: false,
          message: "Maximum OTP attempts exceeded. Please request a new OTP.",
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
    // 13. Check Existing User Status
    // ----------------------------------------------------------

    else {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message:
            "Your account is inactive. Please contact support.",
        });
      }

      // --------------------------------------------------------
      // Update Existing User
      // --------------------------------------------------------

      user.isVerified = true;
      user.lastLoginAt = new Date();

      await user.save();
    }

    // ----------------------------------------------------------
    // 14. Generate JWT
    // ----------------------------------------------------------

    const token = generateToken(user);

    // ----------------------------------------------------------
    // 15. Login Response
    // ----------------------------------------------------------

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
    console.error(
      "VERIFY OTP CONTROLLER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP.",
      error:
        process.env.NODE_ENV !== "production"
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// RESEND OTP
// ============================================================

exports.resendOTP = async (req, res) => {
  try {
    let { mobileNumber } = req.body;

    // ----------------------------------------------------------
    // 1. Check Mobile Number
    // ----------------------------------------------------------

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required.",
      });
    }

    // ----------------------------------------------------------
    // 2. Normalize Mobile Number
    // ----------------------------------------------------------

    mobileNumber = normalizeMobileNumber(mobileNumber);

    // ----------------------------------------------------------
    // 3. Validate Mobile Number
    // ----------------------------------------------------------

    if (!isValidMobileNumber(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid mobile number.",
      });
    }

    // ----------------------------------------------------------
    // 4. Generate New OTP
    // ----------------------------------------------------------

    const otpResult = await otpService.sendOTP({
      mobileNumber,
      purpose: "LOGIN",
    });

    // ----------------------------------------------------------
    // 5. Development Response
    // ----------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully.",

      ...(process.env.NODE_ENV !== "production" && {
        otp: otpResult.otp,
        expiresAt: otpResult.expiresAt,
      }),
    });
  } catch (error) {
    console.error(
      "RESEND OTP CONTROLLER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to resend OTP.",
      error:
        process.env.NODE_ENV !== "production"
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// GOOGLE SIGN-IN
// ============================================================

exports.googleSignIn = async (req, res) => {
  try {
    const { credential } = req.body;

    // ----------------------------------------------------------
    // 1. Check Google Credential
    // ----------------------------------------------------------

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required.",
      });
    }

    // ----------------------------------------------------------
    // 2. Verify Google ID Token
    // ----------------------------------------------------------

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    // ----------------------------------------------------------
    // 3. Get Google Payload
    // ----------------------------------------------------------

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google credential.",
      });
    }

    // ----------------------------------------------------------
    // 4. Get Google User Information
    // ----------------------------------------------------------

    const googleId = payload.sub;

    const email = payload.email
      ? payload.email.toLowerCase().trim()
      : null;

    const name = payload.name || null;

    const profileImage =
      payload.picture || null;

    const emailVerified =
      payload.email_verified;

    // ----------------------------------------------------------
    // 5. Validate Google Information
    // ----------------------------------------------------------

    if (!googleId || !email) {
      return res.status(400).json({
        success: false,
        message:
          "Unable to get required Google account information.",
      });
    }

    // ----------------------------------------------------------
    // 6. Check Email Verification
    // ----------------------------------------------------------

    if (!emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Google email is not verified.",
      });
    }

    // ----------------------------------------------------------
    // 7. Find Existing User
    //
    // First check googleId.
    // Then check email.
    // ----------------------------------------------------------

    let user = await User.findOne({
      $or: [
        {
          googleId: googleId,
        },
        {
          email: email,
        },
      ],
    });

    // ----------------------------------------------------------
    // 8. Create New Google Customer
    // ----------------------------------------------------------

    if (!user) {
      user = await User.create({
        name: name,

        // Google does not provide mobile number
        mobileNumber: null,

        email: email,

        googleId: googleId,

        profileImage: profileImage,

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
          message: "Your account is inactive. Please contact support.",
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
        name: user.name || null,
        mobileNumber:
          user.mobileNumber || null,
        email: user.email || null,
        role: user.role,
        profileImage:
          user.profileImage || null,
        isVerified: user.isVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error(
      "GOOGLE SIGN-IN ERROR:",
      error
    );

    return res.status(401).json({
      success: false,
      message: "Google authentication failed.",
      error:
        process.env.NODE_ENV !== "production"
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// UPDATE PROFILE
// ============================================================

exports.updateProfile = async (req, res) => {
  try {
    const userId =
      req.user.id || req.user._id;

    const {
      name,
      email,
    } = req.body;

    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ----------------------------------------------------------
    // Update Name
    // ----------------------------------------------------------

    if (name !== undefined) {
      user.name = name;
    }

    // ----------------------------------------------------------
    // Update Email
    // ----------------------------------------------------------

    if (email !== undefined) {
      user.email = email;
    }

    // ----------------------------------------------------------
    // Update Profile Image
    // ----------------------------------------------------------

    if (
      req.body.profileImage !== undefined
    ) {
      user.profileImage =
        req.body.profileImage;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Profile updated successfully",

      user: {
        id: user._id,
        name: user.name,
        mobileNumber:
          user.mobileNumber,
        email: user.email,
        role: user.role,
        profileImage:
          user.profileImage,
        isVerified:
          user.isVerified,
        isActive:
          user.isActive,
      },
    });
  } catch (error) {
    console.error(
      "Update Profile Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update profile",
      error: error.message,
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

    const userId =
      req.user._id ||
      req.user.id;

    // ----------------------------------------------------------
    // 3. Validate
    // ----------------------------------------------------------

    const user =
      await User.findById(userId)
        .select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "Please enter a valid mobile number.",
      });
    }

    // ----------------------------------------------------------
    // 4. Generate new OTP
    // ----------------------------------------------------------

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is inactive.",
      });

    // ----------------------------------------------------------
    // 5. Response
    // ----------------------------------------------------------

    return res.status(200).json({
      success: true,

      user: {
        id: user._id,
        name: user.name || null,
        mobileNumber:
          user.mobileNumber || null,
        email: user.email || null,
        role: user.role,
        profileImage:
          user.profileImage || null,
        isVerified:
          user.isVerified,
        isActive:
          user.isActive,
      },
    });
  } catch (error) {
    console.error(
      "GET ME ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch user information.",
      error:
        process.env.NODE_ENV !== "production"
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// LOGOUT
// ============================================================

exports.logout = async (req, res) => {
  try {
    /*
      JWT is stateless.

      For the current implementation,
      frontend should remove the JWT token.

      Later you can implement:
      - Token blacklist
      - Refresh token
      - Session management
      - Redis token revocation
    */

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    console.error(
      "LOGOUT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to logout.",
      error:
        process.env.NODE_ENV !== "production"
          ? error.message
          : undefined,
    });
  }
};
