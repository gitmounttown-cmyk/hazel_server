const express = require("express");

const router = express.Router();

const {
  addToCart,
  getCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
} = require("../controllers/cartController");

const { verifyToken } = require("../middleware/authMiddleware");

// ============================================================
// ADD PRODUCT TO CART
// ============================================================

router.post("/add", verifyToken, addToCart);

// ============================================================
// GET CART
// ============================================================

router.get("/all", verifyToken, getCart);

// ============================================================
// GET CART COUNT
// ============================================================

router.get("/count", verifyToken, getCartCount);

// ============================================================
// UPDATE CART QUANTITY
// ============================================================

router.put("/update/:itemId", verifyToken, updateCartQuantity);

// ============================================================
// REMOVE CART ITEM
// ============================================================

router.delete("/remove/:itemId", verifyToken, removeFromCart);

// ============================================================
// CLEAR CART
// ============================================================

router.delete("/clear", verifyToken, clearCart);

module.exports = router;
