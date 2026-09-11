const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  if (!user || !user._id) {
    throw new Error("User information is required to generate token");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      mobileNumber: user.mobileNumber,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

module.exports = generateToken;