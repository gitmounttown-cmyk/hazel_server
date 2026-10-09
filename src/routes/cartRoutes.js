const express = require("express");
const router = express.Router();

const {
  addToCart,
  getCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
} = require("../controllers/cartController");

const { verifyToken, optionalAuth } = require("../middleware/authMiddleware");

// Add item
// router.post("/add", verifyToken, addToCart);
router.post("/add", optionalAuth, addToCart);

// Get cart
// router.get("/all", verifyToken, getCart);
router.get("/all", optionalAuth, getCart);

// Update item quantity
router.put("/update", verifyToken, updateCartQuantity);

// Remove single item
// router.delete("/remove", verifyToken, removeFromCart);
router.delete("/remove", optionalAuth, removeFromCart);

// Clear entire cart
// router.delete("/clear", verifyToken, clearCart);
router.delete("/clear", optionalAuth, clearCart);

module.exports = router;