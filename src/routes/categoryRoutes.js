const express = require("express");

const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const {
  uploadCategoryImage,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

// ==========================================================
// CREATE CATEGORY
// POST /api/categories/create
// ==========================================================
router.post(
  "/create",
  uploadCategoryImage.single("image"),
  createCategory
);

// ==========================================================
// GET ALL CATEGORIES
// GET /api/categories/all
// ==========================================================
router.get(
  "/all",
  getCategories
);

// ==========================================================
// GET CATEGORY BY ID
// GET /api/categories/:id
// ==========================================================
router.get(
  "/:id",
  getCategoryById
);

// ==========================================================
// UPDATE CATEGORY
// PUT /api/categories/update/:id
// ==========================================================
router.put(
  "/update/:id",
  uploadCategoryImage.single("image"),
  updateCategory
);

// ==========================================================
// DELETE CATEGORY
// DELETE /api/categories/delete/:id
// ==========================================================
router.delete(
  "/delete/:id",
  deleteCategory
);

module.exports = router;