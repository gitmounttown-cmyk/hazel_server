const express = require("express");

const router = express.Router();

// ==========================================================
// IMPORT CONTROLLER
// ==========================================================

const {
  createBannerProduct,
  getAllBannerProducts,
  getBannerProductById,
  getProductsByBannerId,
  updateBannerProduct,
  deleteBannerProduct,
} = require("../controllers/bannerProductController");

// ==========================================================
// CREATE BANNER PRODUCT
// POST /api/banner-products
// ==========================================================

router.post(
  "/create",
  createBannerProduct
);

// ==========================================================
// GET ALL BANNER PRODUCTS
// GET /api/banner-products
// ==========================================================

router.get(
  "/all",
  getAllBannerProducts
);

// ==========================================================
// GET PRODUCTS BY BANNER ID
// GET /api/banner-products/banner/:bannerId
// ==========================================================

router.get(
  "/banner/:bannerId",
  getProductsByBannerId
);

// ==========================================================
// GET BANNER PRODUCT BY ID
// GET /api/banner-products/:id
// ==========================================================

router.get(
  "/:id",
  getBannerProductById
);

// ==========================================================
// UPDATE BANNER PRODUCT
// PUT /api/banner-products/:id
// ==========================================================

router.put(
  "/update/:id",
  updateBannerProduct
);

// ==========================================================
// DELETE BANNER PRODUCT
// DELETE /api/banner-products/:id
// ==========================================================

router.delete(
  "/delete/:id",
  deleteBannerProduct
);

module.exports = router;