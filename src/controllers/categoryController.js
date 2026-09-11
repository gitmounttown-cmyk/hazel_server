const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const Category = require("../models/categoryModel");

// ==========================================================
// HELPER: GET IMAGE URL
// ==========================================================

const getImageURL = (file) => {
  if (!file) {
    return null;
  }

  return `/uploads/categories/${file.filename}`;
};

// ==========================================================
// HELPER: DELETE OLD IMAGE
// ==========================================================

const deleteOldImage = (imageURL) => {
  if (!imageURL) {
    return;
  }

  try {
    const fileName = path.basename(imageURL);

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "categories",
      fileName
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Delete old category image error:", error);
  }
};

// ==========================================================
// CREATE CATEGORY
// POST /api/categories/create
// ==========================================================

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // ======================================================
    // VALIDATION
    // ======================================================

    if (!name || !name.trim()) {
      if (req.file) {
        deleteOldImage(
          `/uploads/categories/${req.file.filename}`
        );
      }

      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // ======================================================
    // IMAGE VALIDATION
    // ======================================================

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Category image is required",
      });
    }

    // ======================================================
    // CHECK DUPLICATE CATEGORY
    // ======================================================

    const categoryName = name.trim();

    const existingCategory = await Category.findOne({
      name: categoryName,
    });

    if (existingCategory) {
      deleteOldImage(
        `/uploads/categories/${req.file.filename}`
      );

      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    // ======================================================
    // IMAGE URL
    // ======================================================

    const imageURL = getImageURL(req.file);

    // ======================================================
    // CREATE CATEGORY
    // ======================================================

    const category = await Category.create({
      name: categoryName,
      imageURL,
    });

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Create Category Error:", error);

    // Delete uploaded image if database creation fails
    if (req.file) {
      deleteOldImage(
        `/uploads/categories/${req.file.filename}`
      );
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL CATEGORIES
// GET /api/categories/all
// ==========================================================

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Get Categories Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

// ==========================================================
// GET CATEGORY BY ID
// GET /api/categories/:id
// ==========================================================

const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // ======================================================
    // VALIDATE OBJECT ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // ======================================================
    // FIND CATEGORY
    // ======================================================

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      data: category,
    });
  } catch (error) {
    console.error("Get Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE CATEGORY
// PUT /api/categories/update/:id
// ==========================================================

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // ======================================================
    // VALIDATE OBJECT ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (req.file) {
        deleteOldImage(
          `/uploads/categories/${req.file.filename}`
        );
      }

      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // ======================================================
    // FIND CATEGORY
    // ======================================================

    const category = await Category.findById(id);

    if (!category) {
      if (req.file) {
        deleteOldImage(
          `/uploads/categories/${req.file.filename}`
        );
      }

      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ======================================================
    // UPDATE NAME
    // ======================================================

    if (name !== undefined) {
      const trimmedName = name.trim();

      if (!trimmedName) {
        if (req.file) {
          deleteOldImage(
            `/uploads/categories/${req.file.filename}`
          );
        }

        return res.status(400).json({
          success: false,
          message: "Category name cannot be empty",
        });
      }

      // Check duplicate name
      if (trimmedName !== category.name) {
        const duplicateCategory = await Category.findOne({
          name: trimmedName,
          _id: { $ne: id },
        });

        if (duplicateCategory) {
          if (req.file) {
            deleteOldImage(
              `/uploads/categories/${req.file.filename}`
            );
          }

          return res.status(409).json({
            success: false,
            message:
              "Another category with this name already exists",
          });
        }
      }

      category.name = trimmedName;
    }

    // ======================================================
    // UPDATE IMAGE
    // ======================================================

    if (req.file) {
      const oldImageURL = category.imageURL;

      category.imageURL = getImageURL(req.file);

      // Delete old image after new image is accepted
      deleteOldImage(oldImageURL);
    }

    // ======================================================
    // SAVE
    // ======================================================

    const updatedCategory = await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Update Category Error:", error);

    if (req.file) {
      deleteOldImage(
        `/uploads/categories/${req.file.filename}`
      );
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE CATEGORY
// DELETE /api/categories/delete/:id
// ==========================================================

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // ======================================================
    // VALIDATE OBJECT ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // ======================================================
    // FIND CATEGORY
    // ======================================================

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ======================================================
    // DELETE IMAGE
    // ======================================================

    deleteOldImage(category.imageURL);

    // ======================================================
    // DELETE CATEGORY
    // ======================================================

    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};