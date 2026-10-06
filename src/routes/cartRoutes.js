const express = require("express");

const router = express.Router();

const {
  addToCart,
  getCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
} = require("../controllers/cartController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

// Add
router.post(
  "/add",
  verifyToken,
  addToCart
);

// Get
router.get(
  "/all",
  verifyToken,
  getCart
);

// Update
router.put(
  "/update",
  verifyToken,
  updateCartQuantity
);

// Remove
router.delete(
  "/remove",
  verifyToken,
  removeFromCart
);

// Clear
router.delete(
  "/clear",
  verifyToken,
  clearCart
);

module.exports = router;