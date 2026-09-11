const express = require("express");

const router = express.Router();

const {
  createSimilarProduct,
  getAllSimilarProducts,
  getSimilarProductsByProduct,
  getSimilarProductById,
  updateSimilarProduct,
  deleteSimilarProduct,
} = require("../controllers/similarProductController");

// Create
router.post("/create", createSimilarProduct);

// Get all
router.get("/all", getAllSimilarProducts);

// Get similar products for a specific product
router.get("/product/:productId", getSimilarProductsByProduct);

// Get single
router.get("/:id", getSimilarProductById);

// Update
router.put("/update/:id", updateSimilarProduct);

// Delete
router.delete("/delete/:id", deleteSimilarProduct);

module.exports = router;