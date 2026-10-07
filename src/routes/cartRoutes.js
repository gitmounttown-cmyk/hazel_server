const express = require("express");
const router = express.Router();

const {
  addToCart,
  getCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
} = require("../controllers/cartController");

const { verifyToken } = require("../middleware/authMiddleware");

// Add item
router.post("/add", verifyToken, addToCart);

// Get cart
router.get("/all", verifyToken, getCart);

// Update item quantity
router.put("/update", verifyToken, updateCartQuantity);

// Remove single item
router.delete("/remove", verifyToken, removeFromCart);

// Clear entire cart
router.delete("/clear", verifyToken, clearCart);

module.exports = router;