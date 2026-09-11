const express = require("express");

const router = express.Router();

const {
  createCoupon,
  getCoupons,
  getCouponById,
  validateCoupon,
  updateCoupon,
  deleteCoupon
} = require("../controllers/couponController");

const { verifyToken } = require("../middleware/authMiddleware");

// =============================================================
// CUSTOMER
// =============================================================

router.post(
  "/validate",
  verifyToken,
  validateCoupon
);

// =============================================================
// ADMIN
// =============================================================

router.post(
  "/create",
  verifyToken,
  createCoupon
);

router.get(
  "/all",
  verifyToken,
  getCoupons
);

router.get(
  "/:id",
  verifyToken,
  getCouponById
);

router.patch(
  "/update/:id",
  verifyToken,
  updateCoupon
);

router.delete(
  "/delete/:id",
  verifyToken,
  deleteCoupon
);

module.exports = router;