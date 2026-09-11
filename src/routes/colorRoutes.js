const express = require("express");

const router = express.Router();

const colorController = require("../controllers/colorController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

// ============================================================
// COLOR ROUTES
// ============================================================

// Create
router.post(
  "/create",
  verifyToken,
  colorController.createColor
);

// Get all
router.get(
  "/all",
  verifyToken,
  colorController.getAllColors
);

// Get by ID
router.get(
  "/:id",
  verifyToken,
  colorController.getColorById
);

// Update
router.put(
  "/update/:id",
  verifyToken,
  colorController.updateColor
);

// Delete
router.delete(
  "/delete/:id",
  verifyToken,
  colorController.deleteColor
);

module.exports = router;