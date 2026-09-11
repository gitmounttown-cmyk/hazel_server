const express = require("express");

const router = express.Router();

const sizeController = require("../controllers/sizeController");

const {
  verifyToken
} = require("../middleware/authMiddleware");

// ============================================================
// SIZE ROUTES
// ============================================================

// Create size
router.post(
  "/create",
  verifyToken,
  sizeController.createSize
);

// Get all sizes
router.get(
  "/all",
  verifyToken,
  sizeController.getAllSizes
);

// Get single size
router.get(
  "/:id",
  verifyToken,
  sizeController.getSizeById
);

// Update size
router.put(
  "/update/:id",
  verifyToken,
  sizeController.updateSize
);

// Soft delete size
router.delete(
  "/delete/:id",
  verifyToken,
  sizeController.deleteSize
);



module.exports = router;