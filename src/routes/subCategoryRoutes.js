const express = require("express");

const {
  createSubCategory,
  getSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
} = require("../controllers/subCategoryController");

const {
  uploadSubCategoryImage,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

// ==========================================================
// CREATE
// POST /api/subcategories/create
// ==========================================================

router.post(
  "/create",
  uploadSubCategoryImage.single("image"),
  createSubCategory
);

// ==========================================================
// GET ALL
// GET /api/subcategories/all
// ==========================================================

router.get("/all", getSubCategories);

// ==========================================================
// GET BY ID
// GET /api/subcategories/:id
// ==========================================================

router.get("/:id", getSubCategoryById);

// ==========================================================
// UPDATE
// PUT /api/subcategories/update/:id
// ==========================================================

router.put(
  "/update/:id",
  uploadSubCategoryImage.single("image"),
  updateSubCategory
);

// ==========================================================
// DELETE
// DELETE /api/subcategories/delete/:id
// ==========================================================

router.delete("/delete/:id", deleteSubCategory);

module.exports = router;