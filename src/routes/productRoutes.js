const express = require("express");

const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
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
// GET PRODUCT BY ID
// GET /api/products/:productId
// ============================================================

router.get("/:productId", getProductById);

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

router.delete("/delete/:productId", deleteProduct);

module.exports = router;