const express = require("express");

const router = express.Router();

const brandController = require("../controllers/brandController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  uploadBrandImage,
} = require("../middleware/brandMiddleware");

// ==========================================================
// CREATE BRAND
// ==========================================================

router.post(
  "/create",
  verifyToken,
  uploadBrandImage.single("imageURL"),
  brandController.createBrand
);

// ==========================================================
// GET ALL BRANDS
// ==========================================================

router.get(
  "/all",
  verifyToken,
  brandController.getBrands
);

// ==========================================================
// GET SINGLE BRAND
// ==========================================================

router.get(
  "/:id",
  verifyToken,
  brandController.getBrand
);

// ==========================================================
// UPDATE BRAND
// ==========================================================

router.put(
  "/update/:id",
  verifyToken,
  uploadBrandImage.single("imageURL"),
  brandController.updateBrand
);

// ==========================================================
// DELETE BRAND
// ==========================================================

router.delete(
  "/delete/:id",
  verifyToken,
  brandController.deleteBrand
);

module.exports = router;