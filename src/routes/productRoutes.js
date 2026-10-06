const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");

const { uploadProductMedia } = require("../middleware/uploadMiddleware");

const {
  createProduct,
  uploadProductMediaHandler,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");


// ============================================================
// GET ALL PRODUCTS
// ============================================================

router.get("/all", getAllProducts);


// ============================================================
// UPLOAD PRODUCT MEDIA
// ============================================================

router.post(
  "/upload-media",
  verifyToken,
  uploadProductMedia.array("media", 10),
  uploadProductMediaHandler
);


// ============================================================
// CREATE PRODUCT
// ============================================================

router.post(
  "/create",
  verifyToken,
  uploadProductMedia.array("media", 10),
  createProduct
);


// ============================================================
// UPDATE PRODUCT
// ============================================================

router.put(
  "/update/:productId",
  verifyToken,
  uploadProductMedia.array("media", 10),
  updateProduct
);


// ============================================================
// DELETE PRODUCT
// ============================================================

router.delete(
  "/delete/:productId",
  verifyToken,
  deleteProduct
);


// ============================================================
// GET PRODUCT BY ID
// IMPORTANT: Keep this at the bottom
// ============================================================

router.get("/:productId", getProductById);


module.exports = router;