const express = require("express");

const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addVariantMedia,
  deleteVariantMedia,
} = require("../controllers/productController");

const {
  uploadProductMedia,
  handleUploadError,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

// ============================================================
// CREATE PRODUCT
// POST /api/products/create
// ============================================================

router.post(
  "/create",
  uploadProductMedia.array("media", 10),
  handleUploadError,
  createProduct
);

// ============================================================
// GET ALL PRODUCTS
// GET /api/products/all
// ============================================================

router.get("/all", getAllProducts);

// ============================================================
// UPDATE PRODUCT
// PUT /api/products/update/:productId
// ============================================================

router.put(
  "/update/:productId",
  uploadProductMedia.array("media", 10),
  handleUploadError,
  updateProduct
);

// ============================================================
// DELETE PRODUCT
// DELETE /api/products/delete/:productId
// ============================================================

router.delete(
  "/delete/:productId",
  deleteProduct
);

// ============================================================
// ADD VARIANT MEDIA
// Express routes mapped to handle both /variant/ and /variants/
// using :color parameter to match productController.js expectations
// ============================================================

router.post(
  "/:productId/variant/:color/media",
  uploadProductMedia.array("media", 10),
  handleUploadError,
  addVariantMedia
);

router.post(
  "/:productId/variants/:color/media",
  uploadProductMedia.array("media", 10),
  handleUploadError,
  addVariantMedia
);

// ============================================================
// DELETE VARIANT MEDIA
// ============================================================

router.delete(
  "/:productId/variant/:color/media/:mediaId",
  deleteVariantMedia
);

router.delete(
  "/:productId/variants/:color/media/:mediaId",
  deleteVariantMedia
);

// ============================================================
// UPDATE PRODUCT - DIRECT URL
// PUT /api/products/:productId
// ============================================================

router.put(
  "/:productId",
  uploadProductMedia.array("media", 10),
  handleUploadError,
  updateProduct
);

// ============================================================
// DELETE PRODUCT - DIRECT URL
// DELETE /api/products/:productId
// ============================================================

router.delete(
  "/:productId",
  deleteProduct
);

// ============================================================
// GET PRODUCT BY ID
// GET /api/products/:productId
// ============================================================

router.get("/:productId", getProductById);

module.exports = router;