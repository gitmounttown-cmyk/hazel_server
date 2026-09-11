const express = require("express");

const router = express.Router();

const neckPatternController = require(
  "../controllers/neckPatternController"
);

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  uploadNeckPatternImage,
} = require("../middleware/neckPatternMiddleware");

// ==========================================================
// CREATE
// ==========================================================

router.post(
  "/create",
  verifyToken,
  uploadNeckPatternImage.single("image"),
  neckPatternController.createNeckPattern
);

// ==========================================================
// GET ALL
// ==========================================================

router.get(
  "/all",
  verifyToken,
  neckPatternController.getNeckPatterns
);

// ==========================================================
// GET BY SLUG
// IMPORTANT: BEFORE /:id
// ==========================================================

router.get(
  "/slug/:slug",
  verifyToken,
  neckPatternController.getNeckPatternBySlug
);

// ==========================================================
// GET SINGLE
// ==========================================================

router.get(
  "/:id",
  verifyToken,
  neckPatternController.getNeckPattern
);

// ==========================================================
// UPDATE
// ==========================================================

router.put(
  "/update/:id",
  verifyToken,
  uploadNeckPatternImage.single("image"),
  neckPatternController.updateNeckPattern
);

// ==========================================================
// DELETE
// ==========================================================

router.delete(
  "/delete/:id",
  verifyToken,
  neckPatternController.deleteNeckPattern
);

module.exports = router;