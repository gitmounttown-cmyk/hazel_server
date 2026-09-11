const Color = require("../models/colorModel");
const mongoose=require("mongoose")
// ============================================================
// CREATE COLOR
// ============================================================

exports.createColor = async (req, res) => {
  try {
    const { name, code, description } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Color name is required",
      });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Color code is required",
      });
    }

    // Check duplicate name
    const existingColor = await Color.findOne({
      name: name.trim(),
    });

    if (existingColor) {
      return res.status(409).json({
        success: false,
        message: "Color name already exists",
      });
    }

    // Check duplicate code
    const existingCode = await Color.findOne({
      code: code.trim().toUpperCase(),
    });

    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: "Color code already exists",
      });
    }

    const userId = req.user?.id || req.user?._id || null;

    const color = await Color.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description?.trim() || "",
      createdBy: userId,
      updatedBy: userId,
    });

    const populatedColor = await Color.findById(color._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Color created successfully",
      data: populatedColor,
    });
  } catch (error) {
    console.error("Create Color Error:", error);

    // Duplicate key error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      return res.status(409).json({
        success: false,
        message: `${duplicateField} already exists`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create color",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL COLORS
// ============================================================

exports.getAllColors = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // Search by name or code
    if (search.trim()) {
      filter.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          code: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.max(parseInt(limit) || 10, 1);

    const skip = (pageNumber - 1) * limitNumber;

    const [colors, total] = await Promise.all([
      Color.find(filter)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      Color.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Colors fetched successfully",
      data: colors,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get All Colors Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch colors",
      error: error.message,
    });
  }
};

// ============================================================
// GET COLOR BY ID
// ============================================================

exports.getColorById = async (req, res) => {
  try {
    const { id } = req.params;

    const color = await Color.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!color) {
      return res.status(404).json({
        success: false,
        message: "Color not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Color fetched successfully",
      data: color,
    });
  } catch (error) {
    console.error("Get Color By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch color",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE COLOR
// ============================================================

exports.updateColor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;

    const color = await Color.findById(id);

    if (!color) {
      return res.status(404).json({
        success: false,
        message: "Color not found",
      });
    }

    // Check duplicate name
    if (name !== undefined) {
      const existingName = await Color.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });

      if (existingName) {
        return res.status(409).json({
          success: false,
          message: "Color name already exists",
        });
      }

      color.name = name.trim();
    }

    // Check duplicate code
    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();

      const existingCode = await Color.findOne({
        code: normalizedCode,
        _id: { $ne: id },
      });

      if (existingCode) {
        return res.status(409).json({
          success: false,
          message: "Color code already exists",
        });
      }

      color.code = normalizedCode;
    }

    if (description !== undefined) {
      color.description = description.trim();
    }

    const userId = req.user?.id || req.user?._id || null;

    color.updatedBy = userId;

    await color.save();

    const updatedColor = await Color.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Color updated successfully",
      data: updatedColor,
    });
  } catch (error) {
    console.error("Update Color Error:", error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      return res.status(409).json({
        success: false,
        message: `${duplicateField} already exists`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update color",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE COLOR
// ============================================================

exports.deleteColor = async (req, res) => {
  try {
    const { id } = req.params;

    const color = await Color.findById(id);

    if (!color) {
      return res.status(404).json({
        success: false,
        message: "Color not found",
      });
    }

    await Color.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Color deleted successfully",
    });
  } catch (error) {
    console.error("Delete Color Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete color",
      error: error.message,
    });
  }
};