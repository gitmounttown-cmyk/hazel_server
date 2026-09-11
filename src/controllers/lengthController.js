const mongoose = require("mongoose");
const Length = require("../models/lengthModel");

// ==========================================================
// GET LOGGED-IN USER ID
// ==========================================================

const getUserId = (req) => {
  return req.user?.id || req.user?._id || null;
};

// ==========================================================
// GENERATE SLUG
// ==========================================================

const generateSlug = (text) => {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

// ==========================================================
// CREATE UNIQUE SLUG
// ==========================================================

const createUniqueSlug = async (name, excludeId = null) => {
  const baseSlug = generateSlug(name);

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = {
      slug,
    };

    if (excludeId) {
      query._id = {
        $ne: excludeId,
      };
    }

    const existingLength = await Length.findOne(query);

    if (!existingLength) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// ==========================================================
// CREATE LENGTH
// ==========================================================

exports.createLength = async (req, res) => {
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
        message: "Length name is required",
      });
    }

    // ------------------------------------------------------
    // CHECK DUPLICATE NAME
    // ------------------------------------------------------

    const existingLength = await Length.findOne({
      name: {
        $regex: `^${name.trim()}$`,
        $options: "i",
      },
    });

    if (existingLength) {
      return res.status(409).json({
        success: false,
        message: "Length with this name already exists",
      });
    }

    // ------------------------------------------------------
    // VALIDATE STATUS
    // ------------------------------------------------------

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // ------------------------------------------------------
    // GENERATE UNIQUE SLUG
    // ------------------------------------------------------

    const slug = await createUniqueSlug(name);

    // ------------------------------------------------------
    // CREATE
    // ------------------------------------------------------

    const length = await Length.create({
      name: name.trim(),
      slug,
      description: description.trim(),
      status,
      createdBy: getUserId(req),
    });

    return res.status(201).json({
      success: true,
      message: "Length created successfully",
      data: length,
    });
  } catch (error) {
    console.error("Create length error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Length with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create length",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL LENGTHS
// ==========================================================

exports.getLengths = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      status,
    } = req.query;

    page = Math.max(parseInt(page) || 1, 1);

    limit = Math.min(
      Math.max(parseInt(limit) || 10, 1),
      100
    );

    const skip = (page - 1) * limit;

    // ======================================================
    // FILTER
    // ======================================================

    const filter = {};

    // ======================================================
    // STATUS
    // ======================================================

    if (status) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      filter.status = status;
    }

    // ======================================================
    // SEARCH
    // ======================================================

    if (search.trim()) {
      filter.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          slug: {
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

    // ======================================================
    // QUERY
    // ======================================================

    const [lengths, total] = await Promise.all([
      Length.find(filter)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Length.countDocuments(filter),
    ]);

    // ======================================================
    // PAGINATION
    // ======================================================

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Lengths fetched successfully",

      data: lengths,

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
    console.error("Get lengths error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch lengths",
      error: error.message,
    });
  }
};

// ==========================================================
// GET SINGLE LENGTH
// ==========================================================

exports.getLength = async (req, res) => {
  try {
    const { id } = req.params;

    // ------------------------------------------------------
    // VALIDATE OBJECT ID
    // ------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid length ID",
      });
    }

    // ------------------------------------------------------
    // FIND
    // ------------------------------------------------------

    const length = await Length.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!length) {
      return res.status(404).json({
        success: false,
        message: "Length not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Length fetched successfully",
      data: length,
    });
  } catch (error) {
    console.error("Get length error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch length",
      error: error.message,
    });
  }
};

// ==========================================================
// GET LENGTH BY SLUG
// ==========================================================

exports.getLengthBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const length = await Length.findOne({
      slug: slug.toLowerCase(),
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!length) {
      return res.status(404).json({
        success: false,
        message: "Length not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Length fetched successfully",
      data: length,
    });
  } catch (error) {
    console.error("Get length by slug error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch length",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE LENGTH
// ==========================================================

exports.updateLength = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      status,
    } = req.body;

    // ------------------------------------------------------
    // VALIDATE OBJECT ID
    // ------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid length ID",
      });
    }

    // ------------------------------------------------------
    // FIND LENGTH
    // ------------------------------------------------------

    const length = await Length.findById(id);

    if (!length) {
      return res.status(404).json({
        success: false,
        message: "Length not found",
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
          message: "Length name cannot be empty",
        });
      }

      // Check duplicate name
      const duplicateLength = await Length.findOne({
        name: {
          $regex: `^${trimmedName}$`,
          $options: "i",
        },
        _id: {
          $ne: id,
        },
      });

      if (duplicateLength) {
        return res.status(409).json({
          success: false,
          message:
            "Another length with this name already exists",
        });
      }

      length.name = trimmedName;

      // Automatically regenerate slug
      length.slug = await createUniqueSlug(
        trimmedName,
        id
      );
    }

    // ------------------------------------------------------
    // DESCRIPTION
    // ------------------------------------------------------

    if (description !== undefined) {
      length.description = description.trim();
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

      length.status = status;
    }

    // ------------------------------------------------------
    // AUDIT
    // ------------------------------------------------------

    length.updatedBy = getUserId(req);

    await length.save();

    return res.status(200).json({
      success: true,
      message: "Length updated successfully",
      data: length,
    });
  } catch (error) {
    console.error("Update length error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Length with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update length",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE LENGTH
// ==========================================================

exports.deleteLength = async (req, res) => {
  try {
    const { id } = req.params;

    // ------------------------------------------------------
    // VALIDATE OBJECT ID
    // ------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid length ID",
      });
    }

    // ------------------------------------------------------
    // FIND LENGTH
    // ------------------------------------------------------

    const length = await Length.findById(id);

    if (!length) {
      return res.status(404).json({
        success: false,
        message: "Length not found",
      });
    }

    // ------------------------------------------------------
    // DELETE
    // ------------------------------------------------------

    await Length.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Length deleted successfully",
    });
  } catch (error) {
    console.error("Delete length error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete length",
      error: error.message,
    });
  }
};