const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

// ============================================================
// VERIFY TOKEN
// ============================================================

exports.verifyToken = async (req, res, next) => {
  try {
    // ----------------------------------------------------------
    // 1. Get Authorization Header
    // ----------------------------------------------------------

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required.",
      });
    }

    // ----------------------------------------------------------
    // 2. Check Bearer Token
    // ----------------------------------------------------------

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is missing.",
      });
    }

    // ----------------------------------------------------------
    // 3. Verify JWT
    // ----------------------------------------------------------

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired. Please login again.",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    // ----------------------------------------------------------
    // 4. Check User ID
    // ----------------------------------------------------------

    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    // ----------------------------------------------------------
    // 5. Find User
    // ----------------------------------------------------------

    const user = await User.findById(decoded.id).select(
      "-__v"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
      });
    }

    // ----------------------------------------------------------
    // 6. Check Active Status
    // ----------------------------------------------------------

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    // ----------------------------------------------------------
    // 7. Attach User To Request
    // ----------------------------------------------------------

    req.user = user;

    // Keep decoded JWT information if required
    req.auth = decoded;

    // ----------------------------------------------------------
    // 8. Continue
    // ----------------------------------------------------------

    next();
  } catch (error) {
    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

// ============================================================
// ALLOW ROLES
// ============================================================

exports.allowRoles = (...roles) => {
  return (req, res, next) => {
    try {
      // --------------------------------------------------------
      // Check Authentication
      // --------------------------------------------------------

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      // --------------------------------------------------------
      // Check Role
      // --------------------------------------------------------

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to access this resource.",
        });
      }

      next();
    } catch (error) {
      console.error(
        "ROLE MIDDLEWARE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Role authorization failed.",
      });
    }
  };
};