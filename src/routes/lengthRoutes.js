const express = require("express");

const router = express.Router();

const lengthController = require("../controllers/lengthController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

// ==========================================================
// CREATE LENGTH
// ==========================================================

router.post(
  "/create",
  verifyToken,
  lengthController.createLength
);

// ==========================================================
// GET ALL LENGTHS
// ==========================================================

router.get(
  "/all",
  verifyToken,
  lengthController.getLengths
);

// ==========================================================
// GET BY SLUG
// IMPORTANT: KEEP BEFORE /:id
// ==========================================================

router.get(
  "/slug/:slug",
  verifyToken,
  lengthController.getLengthBySlug
);

// ==========================================================
// GET SINGLE LENGTH
// ==========================================================

router.get(
  "/:id",
  verifyToken,
  lengthController.getLength
);

// ==========================================================
// UPDATE LENGTH
// ==========================================================

router.put(
  "/update/:id",
  verifyToken,
  lengthController.updateLength
);

// ==========================================================
// DELETE LENGTH
// ==========================================================

router.delete(
  "/delete/:id",
  verifyToken,
  lengthController.deleteLength
);

module.exports = router;