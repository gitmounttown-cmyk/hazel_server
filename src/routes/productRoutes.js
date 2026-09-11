const express = require("express");

const router =
  express.Router();

// ============================================================
// CONTROLLER
// ============================================================

const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addVariantMedia,
  deleteVariantMedia,
} = require("../controllers/productController");

// ============================================================
// UPLOAD MIDDLEWARE
// ============================================================

const {
  uploadProductMedia,
  handleUploadError,
} = require("../middleware/uploadMiddleware");

// ============================================================
// CREATE PRODUCT
// ============================================================

router.post(
  "/create",

  uploadProductMedia.array(
    "media",
    10
  ),

  handleUploadError,

  createProduct
);

// ============================================================
// GET ALL PRODUCTS
// ============================================================

router.get(
  "/all",
  getAllProducts
);

// ============================================================
// GET PRODUCT BY ID
// ============================================================

router.get(
  "/:productId",
  getProductById
);

// ============================================================
// UPDATE PRODUCT
// ============================================================

router.put(
  "/update/:productId",

  uploadProductMedia.array(
    "media",
    10
  ),

  handleUploadError,

  updateProduct
);

// ============================================================
// DELETE PRODUCT
// ============================================================

router.delete(
  "/delete/:productId",
  deleteProduct
);

// ============================================================
// ADD MEDIA TO VARIANT
// ============================================================

router.post(
  "/:productId/variants/:variantId/media",

  uploadProductMedia.array(
    "media",
    10
  ),

  handleUploadError,

  addVariantMedia
);

// ============================================================
// DELETE MEDIA FROM VARIANT
// ============================================================

router.delete(
  "/:productId/variants/:variantId/media/:mediaId",

  deleteVariantMedia
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;