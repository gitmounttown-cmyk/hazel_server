const Brand = require("../models/brandModel");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
// ==========================================================
// GET LOGGED-IN USER ID
// ==========================================================

const getUserId = (req) => {
  return req.user?.id || req.user?._id || null;
};

// ==========================================================
// DELETE IMAGE FROM LOCAL STORAGE
// ==========================================================

const deleteImage = (imageURL) => {
  try {
    if (!imageURL) return;

    let imagePath = imageURL;

    // If full URL is stored
    if (imageURL.startsWith("http")) {
      const url = new URL(imageURL);
      imagePath = url.pathname;
    }

    imagePath = imagePath.replace(/^\/+/, "");

    const fullPath = path.join(process.cwd(), imagePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error("Delete image error:", error.message);
  }
};

// ==========================================================
// CREATE BRAND
// ==========================================================

exports.createBrand = async (req, res) => {
  try {
    const {
      name,
      description = "",
      status = "active",
    } = req.body;

    // ------------------------------------------------------
    // VALIDATION
    // ------------------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Brand name is required",
      });
    }

    // ------------------------------------------------------
    // CHECK DUPLICATE NAME
    // ------------------------------------------------------

    const existingBrand = await Brand.findOne({
      name: {
        $regex: `^${name.trim()}$`,
        $options: "i",
      },
    });

    if (existingBrand) {
      return res.status(409).json({
        success: false,
        message: "Brand with this name already exists",
      });
    }

    // ------------------------------------------------------
    // IMAGE
    // ------------------------------------------------------

    let imageURL = "";

    if (req.file) {
      imageURL = `/uploads/brands/${req.file.filename}`;
    }

    // ------------------------------------------------------
    // CREATE BRAND
    // ------------------------------------------------------

    const brand = await Brand.create({
      name: name.trim(),
      description: description.trim(),
      imageURL,
      status,
      createdBy: getUserId(req),
    });

    return res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand,
    });
  } catch (error) {
    console.error("Create brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create brand",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL BRANDS
// ==========================================================

exports.getBrands = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    page = Math.max(parseInt(page), 1);
    limit = Math.min(Math.max(parseInt(limit), 1), 100);

    const skip = (page - 1) * limit;

    // ------------------------------------------------------
    // FILTER
    // ------------------------------------------------------

    const filter = {};

    // ------------------------------------------------------
    // STATUS FILTER
    // ------------------------------------------------------

    if (status) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      filter.status = status;
    }

    // ------------------------------------------------------
    // SEARCH
    // ------------------------------------------------------

    if (search.trim()) {
      filter.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          description: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // ------------------------------------------------------
    // SORT
    // ------------------------------------------------------

    const allowedSortFields = [
      "name",
      "status",
      "createdAt",
      "updatedAt",
    ];

    if (!allowedSortFields.includes(sortBy)) {
      sortBy = "createdAt";
    }

    const sort = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    // ------------------------------------------------------
    // GET BRANDS
    // ------------------------------------------------------

    const [brands, total] = await Promise.all([
      Brand.find(filter)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),

      Brand.countDocuments(filter),
    ]);

    // ------------------------------------------------------
    // PAGINATION
    // ------------------------------------------------------

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Brands fetched successfully",

      data: brands,

      pagination: {
        currentPage: page,
        limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get brands error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch brands",
      error: error.message,
    });
  }
};

// ==========================================================
// GET SINGLE BRAND
// ==========================================================

exports.getBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Brand fetched successfully",
      data: brand,
    });
  } catch (error) {
    console.error("Get brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch brand",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE BRAND
// ==========================================================

exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      status,
    } = req.body;

    // ------------------------------------------------------
    // FIND BRAND
    // ------------------------------------------------------

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    // ------------------------------------------------------
    // NAME
    // ------------------------------------------------------

    if (name !== undefined) {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          message: "Brand name cannot be empty",
        });
      }

      // Check duplicate
      const duplicateBrand = await Brand.findOne({
        name: {
          $regex: `^${trimmedName}$`,
          $options: "i",
        },
        _id: {
          $ne: id,
        },
      });

      if (duplicateBrand) {
        return res.status(409).json({
          success: false,
          message: "Another brand with this name already exists",
        });
      }

      brand.name = trimmedName;
    }

    // ------------------------------------------------------
    // DESCRIPTION
    // ------------------------------------------------------

    if (description !== undefined) {
      brand.description = description.trim();
    }

    // ------------------------------------------------------
    // STATUS
    // ------------------------------------------------------

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      brand.status = status;
    }

    // ------------------------------------------------------
    // IMAGE
    // ------------------------------------------------------

    if (req.file) {
      const oldImage = brand.imageURL;

      brand.imageURL =
        `/uploads/brands/${req.file.filename}`;

      // Remove old image
      if (oldImage) {
        deleteImage(oldImage);
      }
    }

    // ------------------------------------------------------
    // AUDIT
    // ------------------------------------------------------

    brand.updatedBy = getUserId(req);

    await brand.save();

    return res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand,
    });
  } catch (error) {
    console.error("Update brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update brand",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE BRAND
// ==========================================================

exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    // ======================================================
    // VALIDATE MONGODB OBJECT ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    // ======================================================
    // FIND BRAND
    // ======================================================

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    // ======================================================
    // DELETE IMAGE
    // ======================================================

    if (brand.imageURL) {
      deleteImage(brand.imageURL);
    }

    // ======================================================
    // DELETE BRAND
    // ======================================================

    await Brand.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error("Delete brand error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete brand",
      error: error.message,
    });
  }
};