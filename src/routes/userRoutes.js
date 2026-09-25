const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const {
  getUserProfile,
  updateUserProfile,
} = require("../controllers/userController");

router.get("/list", verifyToken, getUserProfile);
router.put("/update/profile", verifyToken, updateUserProfile);

module.exports = router;