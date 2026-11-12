const express = require("express");
const router = express.Router();

const {
  createSizeChart,
  getAllSizeCharts,
  getSizeChartById,
  getSizeChartByProductId,
  updateSizeChart,
  deleteSizeChart,
} = require("../controllers/sizeChartController");

const {
  uploadSizeChartImage,
  handleUploadError,
} = require("../middleware/uploadMiddleware");

// ==========================================================
// SIZE CHART ROUTES
// ==========================================================

// Create new size chart (with optional images)
router.post(
  "/create",
  uploadSizeChartImage.any(),
  handleUploadError,
  createSizeChart
);

// Get all size charts
router.get("/all", getAllSizeCharts);

// Get size chart for product (dynamic verification)
router.get("/product/:productId", getSizeChartByProductId);

// Get single size chart by ID
router.get("/:id", getSizeChartById);

// Update size chart
router.put(
  "/update/:id",
  uploadSizeChartImage.any(),
  handleUploadError,
  updateSizeChart
);

// Delete size chart
router.delete("/delete/:id", deleteSizeChart);

module.exports = router;
