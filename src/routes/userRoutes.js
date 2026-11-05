const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
} = require("../controllers/userController");

router.get("/all", verifyToken, getAllUsers);
router.get("/list", verifyToken, getUserProfile);
router.put("/update/profile", verifyToken, updateUserProfile);

module.exports = router;