const express = require("express");

const router = express.Router();

const {
  createReview,
  getProductReviews,
  getAllReviews,
  updateReviewStatus,
  deleteReview
} = require("../controllers/reviewController");

const { verifyToken } = require("../middleware/authMiddleware");

// =============================================================
// CUSTOMER
// =============================================================

router.post(
  "/create",
  verifyToken,
  createReview
);

router.get(
  "/product/:productId",
  getProductReviews
);

// =============================================================
// ADMIN
// =============================================================

router.get(
  "/admin/all",
  verifyToken,
  getAllReviews
);

router.patch(
  "/status/:id",
  verifyToken,
  updateReviewStatus
);

router.delete(
  "/delete/:id",
  verifyToken,
  deleteReview
);

module.exports = router;