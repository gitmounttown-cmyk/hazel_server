const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const SubCategory = require("../models/subCategoryModel");
const Category = require("../models/categoryModel");

// ==========================================================
// IMAGE URL HELPER
// ==========================================================

const getImageURL = (file) => {
  if (!file) return null;

  return `/uploads/subcategories/${file.filename}`;
};

// ==========================================================
// DELETE IMAGE HELPER
// ==========================================================

const deleteImageFile = (imageURL) => {
  if (!imageURL) return;

  try {
    const fileName = path.basename(imageURL);

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "subcategories",
      fileName
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);

      console.log("Deleted image:", filePath);
    }
  } catch (error) {
    console.error("Image delete error:", error.message);
  }
};

// ==========================================================
// CREATE SUB CATEGORY
// POST /api/subcategories/create
// ==========================================================

const createSubCategory = async (req, res) => {
  let uploadedImage = null;

  try {
    const { name, categoryId } = req.body;

    uploadedImage = req.file;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!name || !name.trim()) {
      if (uploadedImage) {
        deleteImageFile(
          `/uploads/subcategories/${uploadedImage.filename}`
        );
      }

      return res.status(400).json({
        success: false,
        message: "Sub category name is required",
      });
    }

    if (!categoryId) {
      if (uploadedImage) {
        deleteImageFile(
          `/uploads/subcategories/${uploadedImage.filename}`
        );
      }

      return res.status(400).json({
        success: false,
        message: "Category ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      if (uploadedImage) {
        deleteImageFile(
          `/uploads/subcategories/${uploadedImage.filename}`
        );
      }

      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (!uploadedImage) {
      return res.status(400).json({
        success: false,
        message: "Sub category image is required",
      });
    }

    // ==========================================
    // CHECK CATEGORY
    // ==========================================

    const category = await Category.findById(categoryId);

    if (!category) {
      deleteImageFile(
        `/uploads/subcategories/${uploadedImage.filename}`
      );

      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ==========================================
    // CHECK DUPLICATE
    // ==========================================

    const existingSubCategory = await SubCategory.findOne({
      name: name.trim(),
      categoryId,
    });

    if (existingSubCategory) {
      deleteImageFile(
        `/uploads/subcategories/${uploadedImage.filename}`
      );

      return res.status(409).json({
        success: false,
        message:
          "Sub category already exists under this category",
      });
    }

    // ==========================================
    // CREATE
    // ==========================================

    const subCategory = await SubCategory.create({
      name: name.trim(),
      categoryId,
      imageURL: getImageURL(uploadedImage),
    });

    // ==========================================
    // RESPONSE WITH CATEGORY DETAILS
    // ==========================================

    const result = await SubCategory.findById(
      subCategory._id
    ).populate(
      "categoryId",
      "name imageURL"
    );

    return res.status(201).json({
      success: true,
      message: "Sub category created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create sub category error:", error);

    if (uploadedImage) {
      deleteImageFile(
        `/uploads/subcategories/${uploadedImage.filename}`
      );
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create sub category",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL SUB CATEGORIES
// GET /api/subcategories/all
// ==========================================================

const getSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.find()
      .populate("categoryId", "name imageURL");

    return res.status(200).json({
      success: true,
      count: subCategories.length,
      data: subCategories,
    });
  } catch (error) {
    console.error("Get sub categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sub categories",
      error: error.message,
    });
  }
};

// ==========================================================
// GET SUB CATEGORY BY ID
// GET /api/subcategories/:id
// ==========================================================

const getSubCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub category ID",
      });
    }

    // ==========================================
    // FIND + POPULATE CATEGORY
    // ==========================================

    const subCategory = await SubCategory.findById(id).populate(
      "categoryId",
      "name imageURL"
    );

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Sub category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: subCategory,
    });
  } catch (error) {
    console.error("Get sub category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sub category",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE SUB CATEGORY
// PUT /api/subcategories/update/:id
// ==========================================================

const updateSubCategory = async (req, res) => {
  let uploadedImage = null;

  try {
    const { id } = req.params;
    const { name, categoryId } = req.body;

    uploadedImage = req.file;

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (uploadedImage) {
        deleteImageFile(
          `/uploads/subcategories/${uploadedImage.filename}`
        );
      }

      return res.status(400).json({
        success: false,
        message: "Invalid sub category ID",
      });
    }

    // ==========================================
    // FIND SUB CATEGORY
    // ==========================================

    const subCategory = await SubCategory.findById(id);

    if (!subCategory) {
      if (uploadedImage) {
        deleteImageFile(
          `/uploads/subcategories/${uploadedImage.filename}`
        );
      }

      return res.status(404).json({
        success: false,
        message: "Sub category not found",
      });
    }

    // ==========================================
    // UPDATE NAME
    // ==========================================

    if (name !== undefined) {
      if (!name.trim()) {
        if (uploadedImage) {
          deleteImageFile(
            `/uploads/subcategories/${uploadedImage.filename}`
          );
        }

        return res.status(400).json({
          success: false,
          message: "Sub category name cannot be empty",
        });
      }

      subCategory.name = name.trim();
    }

    // ==========================================
    // UPDATE CATEGORY
    // ==========================================

    if (categoryId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        if (uploadedImage) {
          deleteImageFile(
            `/uploads/subcategories/${uploadedImage.filename}`
          );
        }

        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await Category.findById(categoryId);

      if (!category) {
        if (uploadedImage) {
          deleteImageFile(
            `/uploads/subcategories/${uploadedImage.filename}`
          );
        }

        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      subCategory.categoryId = categoryId;
    }

    // ==========================================
    // CHECK DUPLICATE
    // ==========================================

    const duplicate = await SubCategory.findOne({
      _id: { $ne: id },
      name: subCategory.name,
      categoryId: subCategory.categoryId,
    });

    if (duplicate) {
      if (uploadedImage) {
        deleteImageFile(
          `/uploads/subcategories/${uploadedImage.filename}`
        );
      }

      return res.status(409).json({
        success: false,
        message:
          "Another sub category with this name already exists under this category",
      });
    }

    // ==========================================
    // UPDATE IMAGE
    // ==========================================

    const oldImageURL = subCategory.imageURL;

    if (uploadedImage) {
      subCategory.imageURL = getImageURL(uploadedImage);
    }

    // ==========================================
    // UPDATED DATE
    // ==========================================

    subCategory.updatedAt = new Date();

    // ==========================================
    // SAVE
    // ==========================================

    await subCategory.save();

    // ==========================================
    // DELETE OLD IMAGE
    // ==========================================

    if (uploadedImage && oldImageURL) {
      deleteImageFile(oldImageURL);
    }

    // ==========================================
    // POPULATE CATEGORY
    // ==========================================

    const result = await SubCategory.findById(id).populate(
      "categoryId",
      "name imageURL"
    );

    return res.status(200).json({
      success: true,
      message: "Sub category updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update sub category error:", error);

    if (uploadedImage) {
      deleteImageFile(
        `/uploads/subcategories/${uploadedImage.filename}`
      );
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update sub category",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE SUB CATEGORY
// DELETE /api/subcategories/delete/:id
// ==========================================================

const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub category ID",
      });
    }

    // ==========================================
    // FIND SUB CATEGORY
    // ==========================================

    const subCategory = await SubCategory.findById(id);

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Sub category not found",
      });
    }

    // ==========================================
    // DELETE IMAGE
    // ==========================================

    deleteImageFile(subCategory.imageURL);

    // ==========================================
    // DELETE DOCUMENT
    // ==========================================

    await SubCategory.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Sub category deleted successfully",
    });
  } catch (error) {
    console.error("Delete sub category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete sub category",
      error: error.message,
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  createSubCategory,
  getSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
};