const Size = require("../models/sizeModel");
const mongoose=require("mongoose");
// ============================================================
// CREATE SIZE
// ============================================================
exports.createSize = async (req, res) => {
  try {
    const { name, code, description, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Size name is required",
      });
    }

    // Check duplicate name
    const existingName = await Size.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
    });

    if (existingName) {
      return res.status(409).json({
        success: false,
        message: "Size name already exists",
      });
    }

    // Check duplicate code
    if (code && code.trim()) {
      const existingCode = await Size.findOne({
        code: code.trim().toUpperCase(),
      });

      if (existingCode) {
        return res.status(409).json({
          success: false,
          message: "Size code already exists",
        });
      }
    }

    const userId = req.user?.id || req.user?._id || null;

    const size = await Size.create({
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : undefined,
      description: description?.trim() || "",
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userId,
      updatedBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Size created successfully",
      data: size,
    });
  } catch (error) {
    console.error("Create Size Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create size",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL SIZES
// ============================================================
exports.getAllSizes = async (req, res) => {
  try {
    const {
      search = "",
      isActive,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // Search
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

    // Active filter
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.max(parseInt(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const [sizes, total] = await Promise.all([
      Size.find(filter)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .skip(skip)
        .limit(limitNumber),

      Size.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Sizes fetched successfully",
      data: sizes,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get All Sizes Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sizes",
      error: error.message,
    });
  }
};


// ============================================================
// GET SINGLE SIZE
// ============================================================
exports.getSizeById = async (req, res) => {
  try {
    const { id } = req.params;

    const size = await Size.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!size) {
      return res.status(404).json({
        success: false,
        message: "Size not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Size fetched successfully",
      data: size,
    });
  } catch (error) {
    console.error("Get Size Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch size",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE SIZE
// ============================================================
exports.updateSize = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const size = await Size.findById(id);

    if (!size) {
      return res.status(404).json({
        success: false,
        message: "Size not found",
      });
    }

    // Check duplicate name
    if (name !== undefined) {
      const existingName = await Size.findOne({
        _id: { $ne: id },
        name: {
          $regex: `^${name.trim()}$`,
          $options: "i",
        },
      });

      if (existingName) {
        return res.status(409).json({
          success: false,
          message: "Size name already exists",
        });
      }

      size.name = name.trim();
    }

    // Check duplicate code
    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();

      if (normalizedCode) {
        const existingCode = await Size.findOne({
          _id: { $ne: id },
          code: normalizedCode,
        });

        if (existingCode) {
          return res.status(409).json({
            success: false,
            message: "Size code already exists",
          });
        }

        size.code = normalizedCode;
      } else {
        size.code = undefined;
      }
    }

    if (description !== undefined) {
      size.description = description.trim();
    }

    if (isActive !== undefined) {
      size.isActive = isActive;
    }

    size.updatedBy = req.user?.id || req.user?._id || null;

    await size.save();

    return res.status(200).json({
      success: true,
      message: "Size updated successfully",
      data: size,
    });
  } catch (error) {
    console.error("Update Size Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update size",
      error: error.message,
    });
  }
};

// ============================================================
// SOFT DELETE SIZE
// ============================================================
exports.deleteSize = async (req, res) => {
  try {
    const { id } = req.params;

    const size = await Size.findById(id);

    if (!size) {
      return res.status(404).json({
        success: false,
        message: "Size not found",
      });
    }

    size.isActive = false;
    size.updatedBy = req.user?.id || req.user?._id || null;

    await size.save();

    return res.status(200).json({
      success: true,
      message: "Size deleted successfully",
      data: size,
    });
  } catch (error) {
    console.error("Delete Size Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete size",
      error: error.message,
    });
  }
};


