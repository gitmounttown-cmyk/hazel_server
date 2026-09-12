const express = require("express");

const router = express.Router();

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
} = require("../middleware/uploadMiddleware");

// *============================================================*
// *CREATE PRODUCT*
// *POST /api/products/create
// *============================================================*

router.post(
  "/create",
  uploadProductMedia.array("media", 10),
  createProduct
);

// *============================================================*
// *GET ALL PRODUCTS / FILTER PRODUCTS*
// *GET /api/products/all
// *============================================================*

router.get(
  "/all",
  getAllProducts
);

// *============================================================*
// *GET PRODUCT BY ID*
// *GET /api/products/:productId
// *============================================================*

router.get(
  "/:productId",
  getProductById
);

// *============================================================*
// *UPDATE PRODUCT*
// *PUT /api/products/:productId
// *============================================================*

router.put(
  "/:productId",
  uploadProductMedia.array("media", 10),
  updateProduct
);

// *============================================================*
// *DELETE PRODUCT*
// *DELETE /api/products/:productId
// *============================================================*

router.delete(
  "/:productId",
  deleteProduct
);

// *============================================================*
// *ADD VARIANT MEDIA*
// *POST /api/products/:productId/variants/:variantId/media
// *============================================================*

router.post(
  "/:productId/variants/:variantId/media",
  uploadProductMedia.array("media", 10),
  addVariantMedia
);

// *============================================================*
// *DELETE VARIANT MEDIA*
// *DELETE /api/products/:productId/variants/:variantId/media/:mediaId
// *============================================================*

router.delete(
  "/:productId/variants/:variantId/media/:mediaId",
  deleteVariantMedia
);

// *============================================================*
// *EXPORT ROUTER*
// *============================================================*

module.exports = router;