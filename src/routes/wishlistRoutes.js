const express = require("express");

const router = express.Router();

// *==========================================================*
// *CONTROLLERS*
// *==========================================================*

const {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  checkWishlist,
  clearWishlist,
  getWishlistCount,
} = require("../controllers/wishlistController");

// *==========================================================*
// *AUTH MIDDLEWARE*
// *==========================================================*

const { verifyToken } = require("../middleware/authMiddleware");

// *==========================================================*
// *ADD PRODUCT TO WISHLIST*
// *POST /api/wishlist/add
// *==========================================================*

router.post("/add", verifyToken, addToWishlist);

// *==========================================================*
// *GET USER WISHLIST*
// *GET /api/wishlist/all
// *==========================================================*

router.get("/all", verifyToken, getWishlist);

// *==========================================================*
// *GET WISHLIST COUNT*
// *GET /api/wishlist/count
// *==========================================================*

router.get("/count", verifyToken, getWishlistCount);

// *==========================================================*
// *CHECK PRODUCT IN WISHLIST*
// *GET /api/wishlist/check/:productId
// *==========================================================*

router.get("/check/:productId", verifyToken, checkWishlist);

// *==========================================================*
// *REMOVE PRODUCT FROM WISHLIST*
// *DELETE /api/wishlist/remove/:productId
// *==========================================================*

router.delete("/remove/:productId", verifyToken, removeFromWishlist);

// *==========================================================*
// *CLEAR WISHLIST*
// *DELETE /api/wishlist/clear
// *==========================================================*

router.delete("/clear", verifyToken, clearWishlist);

// *==========================================================*
// *EXPORT ROUTER*
// *==========================================================*

module.exports = router;