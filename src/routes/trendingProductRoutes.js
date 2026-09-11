const express = require("express");

const router = express.Router();

// ==========================================================
// CONTROLLER
// ==========================================================

const {
  createTrendingProduct,
  getAllTrendingProducts,
  getTrendingProductById,
  updateTrendingProduct,
  deleteTrendingProduct,
} = require("../controllers/trendingProductController");

// ==========================================================
// UPLOAD MIDDLEWARE
// ==========================================================

const {
  uploadTrendingProductImage,
  handleUploadError,
} = require("../middleware/uploadMiddleware");

// ==========================================================
// CREATE TRENDING PRODUCTS
// ==========================================================
//
// POST
// /api/trending-products/create
//
// form-data:
//
// title
// subtitle
// products
// isActive
// productImages
//
// ==========================================================

router.post(
  "/create",
  uploadTrendingProductImage.array(
    "productImages",
    50
  ),
  handleUploadError,
  createTrendingProduct
);

// ==========================================================
// GET ALL TRENDING PRODUCTS
// ==========================================================
//
// GET
// /api/trending-products
//
// ==========================================================

router.get(
  "/all",
  getAllTrendingProducts
);

// ==========================================================
// GET TRENDING PRODUCT BY ID
// ==========================================================
//
// GET
// /api/trending-products/:id
//
// ==========================================================

router.get(
  "/:id",
  getTrendingProductById
);

// ==========================================================
// UPDATE TRENDING PRODUCTS
// ==========================================================
//
// PUT
// /api/trending-products/:id
//
// ==========================================================

router.put(
  "/update/:id",
  uploadTrendingProductImage.array(
    "productImages",
    50
  ),
  handleUploadError,
  updateTrendingProduct
);

// ==========================================================
// DELETE TRENDING PRODUCTS
// ==========================================================
//
// DELETE
// /api/trending-products/:id
//
// ==========================================================

router.delete(
  "/delete/:id",
  deleteTrendingProduct
);

// ==========================================================
// EXPORT
// ==========================================================

module.exports = router;