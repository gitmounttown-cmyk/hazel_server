const express = require("express");

const router = express.Router();

const {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  increaseCartItem,
  decreaseCartItem,
  clearCart,
} = require("../controllers/CartController");

// Change this path to match your actual auth middleware
const { verifyToken } = require("../middleware/authMiddleware");

// ==========================================================
// ADD PRODUCT TO CART
// POST /api/cart/add
// ==========================================================

router.post(
  "/add",
  verifyToken,
  addToCart
);

// ==========================================================
// GET USER CART
// GET /api/cart
// ==========================================================

router.get(
  "/all",
  verifyToken,
  getCart
);

// ==========================================================
// UPDATE CART ITEM QUANTITY
// PUT /api/cart/item/:itemId
// ==========================================================

router.put(
  "/item/:itemId",
  verifyToken,
  updateCartItem
);

// ==========================================================
// INCREASE QUANTITY
// PATCH /api/cart/item/:itemId/increase
// ==========================================================

router.patch(
  "/item/:itemId/increase",
  verifyToken,
  increaseCartItem
);

// ==========================================================
// DECREASE QUANTITY
// PATCH /api/cart/item/:itemId/decrease
// ==========================================================

router.patch(
  "/item/:itemId/decrease",
  verifyToken,
  decreaseCartItem
);

// ==========================================================
// REMOVE CART ITEM
// DELETE /api/cart/item/:itemId
// ==========================================================

router.delete(
  "/item/:itemId",
  verifyToken,
  removeCartItem
);

// ==========================================================
// CLEAR CART
// DELETE /api/cart/clear
// ==========================================================

router.delete(
  "/clear",
  verifyToken,
  clearCart
);

module.exports = router;