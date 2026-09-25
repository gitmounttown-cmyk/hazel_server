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

// 1. ALL GET/POST STATIC ROUTES
router.get("/all", getAllProducts);

router.post(
  "/upload-media",
  verifyToken,
  uploadProductMedia.array("media", 10),
  uploadProductMediaHandler
);

router.post(
  "/create",
  verifyToken,
  uploadProductMedia.array("media", 10),
  createProduct
);

// 2. PUT ROUTES (Supports BOTH /update/:productId and /:productId to guarantee no 404s)
router.put(
  ["/update/:productId", "/:productId"],
  verifyToken,
  uploadProductMedia.array("media", 10),
  updateProduct
);

// 3. DELETE ROUTES
router.delete(
  ["/delete/:productId", "/:productId"],
  verifyToken,
  deleteProduct
);

// 4. GET SINGLE PRODUCT BY ID (Must stay at the bottom)
router.get("/:productId", getProductById);

module.exports = router;