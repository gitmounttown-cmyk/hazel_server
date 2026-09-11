const express = require("express");

const router = express.Router();

const {
  addToWishlist,
  getWishlist,
  removeWishlistItem,
  removeByVariant,
  clearWishlist,
} = require("../controllers/wishlistController");

// Change this import if your auth middleware has
// a different filename/export.
const {
  verifyToken,
} = require("../middleware/authMiddleware");

// ==========================================================
// ADD TO WISHLIST
// POST /api/wishlist/add
// ==========================================================

router.post(
  "/add",
  verifyToken,
  addToWishlist
);

// ==========================================================
// GET WISHLIST
// GET /api/wishlist
// ==========================================================

router.get(
  "/all",
  verifyToken,
  getWishlist
);

// ==========================================================
// REMOVE WISHLIST ITEM
// DELETE /api/wishlist/item/:itemId
// ==========================================================

router.delete(
  "/item/:itemId",
  verifyToken,
  removeWishlistItem
);

// ==========================================================
// REMOVE BY VARIANT
// DELETE /api/wishlist/variant/:variantId
// ==========================================================

router.delete(
  "/variant/:variantId",
  verifyToken,
  removeByVariant
);

// ==========================================================
// CLEAR WISHLIST
// DELETE /api/wishlist/clear
// ==========================================================

router.delete(
  "/clear",
  verifyToken,
  clearWishlist
);

module.exports = router;