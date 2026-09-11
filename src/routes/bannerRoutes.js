const express = require("express");

const router = express.Router();

// ==========================================================
// IMPORT BANNER CONTROLLER
// ==========================================================

const {
  createBanner,
  getAllBanners,
  getActiveBanners,
  getBannerById,
  // getActiveBanners,
  updateBanner,
  deleteBanner,
} = require("../controllers/bannerController");

// ==========================================================
// IMPORT BANNER UPLOAD MIDDLEWARE
// ==========================================================

const {
  uploadBannerImage,
} = require("../middleware/uploadMiddleware");

// ==========================================================
// CREATE BANNER
// POST /api/banners/create
// ==========================================================

router.post(
  "/create",
  uploadBannerImage.single("image"),
  createBanner
);

// ==========================================================
// GET ALL BANNERS
// GET /api/banners/all
// ==========================================================

router.get(
  "/all",
  getAllBanners
);

// ==========================================================
// GET ACTIVE BANNERS
// GET /api/banners/active
// IMPORTANT: Must be before /:id
// ==========================================================

router.get(
  "/active",
  getActiveBanners
);

// ==========================================================
// GET ACTIVE BANNERS
// IMPORTANT: BEFORE /:id
// GET /api/banners/active
// ==========================================================

// router.get(
//   "/active",
//   getActiveBanners
// );

// ==========================================================
// GET BANNER BY ID
// GET /api/banners/:id
// ==========================================================

router.get(
  "/:id",
  getBannerById
);

// ==========================================================
// UPDATE BANNER
// PUT /api/banners/update/:id
// ==========================================================

router.put(
  "/update/:id",
  uploadBannerImage.single("image"),
  updateBanner
);

// ==========================================================
// DELETE BANNER
// DELETE /api/banners/delete/:id
// ==========================================================

router.delete(
  "/delete/:id",
  deleteBanner
);

module.exports = router;