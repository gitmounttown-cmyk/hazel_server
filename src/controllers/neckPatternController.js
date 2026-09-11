const mongoose = require("mongoose");
const NeckPattern = require("../models/neckPatternModel");

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
    const query = { slug };

    if (excludeId) {
      query._id = {
        $ne: excludeId,
      };
    }

    const existingPattern = await NeckPattern.findOne(query);

    if (!existingPattern) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// ==========================================================
// DELETE IMAGE
// ==========================================================

const fs = require("fs");
const path = require("path");

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

    const fullPath = path.join(
      process.cwd(),
      imagePath
    );

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error(
      "Delete image error:",
      error.message
    );
  }
};

// ==========================================================
// CREATE NECK PATTERN
// ==========================================================

exports.createNeckPattern = async (req, res) => {
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
        message: "Neck pattern name is required",
      });
    }

    // ------------------------------------------------------
    // CHECK DUPLICATE NAME
    // ------------------------------------------------------

    const existingPattern = await NeckPattern.findOne({
      name: {
        $regex: `^${name.trim()}$`,
        $options: "i",
      },
    });

    if (existingPattern) {
      return res.status(409).json({
        success: false,
        message:
          "Neck pattern with this name already exists",
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
    // GENERATE SLUG
    // ------------------------------------------------------

    const slug = await createUniqueSlug(name);

    // ------------------------------------------------------
    // IMAGE
    // ------------------------------------------------------

    let image = "";

    if (req.file) {
      image = `/uploads/neck-patterns/${req.file.filename}`;
    }

    // ------------------------------------------------------
    // CREATE
    // ------------------------------------------------------

    const neckPattern = await NeckPattern.create({
      name: name.trim(),
      slug,
      description: description.trim(),
      image,
      status,
      createdBy: getUserId(req),
    });

    return res.status(201).json({
      success: true,
      message: "Neck pattern created successfully",
      data: neckPattern,
    });
  } catch (error) {
    console.error(
      "Create neck pattern error:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Neck pattern with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create neck pattern",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL NECK PATTERNS
// ==========================================================

exports.getNeckPatterns = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      status,
    } = req.query;

    page = Math.max(
      parseInt(page) || 1,
      1
    );

    limit = Math.min(
      Math.max(parseInt(limit) || 10, 1),
      100
    );

    const skip = (page - 1) * limit;

    // ------------------------------------------------------
    // FILTER
    // ------------------------------------------------------

    const filter = {};

    // ------------------------------------------------------
    // STATUS
    // ------------------------------------------------------

    if (status) {
      if (
        !["active", "inactive"].includes(status)
      ) {
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

    // ------------------------------------------------------
    // QUERY
    // ------------------------------------------------------

    const [neckPatterns, total] =
      await Promise.all([
        NeckPattern.find(filter)
          .populate(
            "createdBy",
            "name email"
          )
          .populate(
            "updatedBy",
            "name email"
          )
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        NeckPattern.countDocuments(filter),
      ]);

    // ------------------------------------------------------
    // PAGINATION
    // ------------------------------------------------------

    const totalPages = Math.ceil(
      total / limit
    );

    return res.status(200).json({
      success: true,
      message:
        "Neck patterns fetched successfully",

      data: neckPatterns,

      pagination: {
        currentPage: page,
        limit,
        totalItems: total,
        totalPages,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1,
      },
    });
  } catch (error) {
    console.error(
      "Get neck patterns error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch neck patterns",
      error: error.message,
    });
  }
};

// ==========================================================
// GET SINGLE NECK PATTERN
// ==========================================================

exports.getNeckPattern = async (req, res) => {
  try {
    const { id } = req.params;

    // ------------------------------------------------------
    // VALIDATE OBJECT ID
    // ------------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid neck pattern ID",
      });
    }

    // ------------------------------------------------------
    // FIND
    // ------------------------------------------------------

    const neckPattern =
      await NeckPattern.findById(id)
        .populate(
          "createdBy",
          "name email"
        )
        .populate(
          "updatedBy",
          "name email"
        );

    if (!neckPattern) {
      return res.status(404).json({
        success: false,
        message: "Neck pattern not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Neck pattern fetched successfully",
      data: neckPattern,
    });
  } catch (error) {
    console.error(
      "Get neck pattern error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch neck pattern",
      error: error.message,
    });
  }
};

// ==========================================================
// GET NECK PATTERN BY SLUG
// ==========================================================

exports.getNeckPatternBySlug = async (
  req,
  res
) => {
  try {
    const { slug } = req.params;

    const neckPattern =
      await NeckPattern.findOne({
        slug: slug.toLowerCase(),
      })
        .populate(
          "createdBy",
          "name email"
        )
        .populate(
          "updatedBy",
          "name email"
        );

    if (!neckPattern) {
      return res.status(404).json({
        success: false,
        message: "Neck pattern not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Neck pattern fetched successfully",
      data: neckPattern,
    });
  } catch (error) {
    console.error(
      "Get neck pattern by slug error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch neck pattern",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE NECK PATTERN
// ==========================================================

exports.updateNeckPattern = async (
  req,
  res
) => {
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

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid neck pattern ID",
      });
    }

    // ------------------------------------------------------
    // FIND
    // ------------------------------------------------------

    const neckPattern =
      await NeckPattern.findById(id);

    if (!neckPattern) {
      return res.status(404).json({
        success: false,
        message: "Neck pattern not found",
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
          message:
            "Neck pattern name cannot be empty",
        });
      }

      // Check duplicate name

      const duplicatePattern =
        await NeckPattern.findOne({
          name: {
            $regex: `^${trimmedName}$`,
            $options: "i",
          },

          _id: {
            $ne: id,
          },
        });

      if (duplicatePattern) {
        return res.status(409).json({
          success: false,
          message:
            "Another neck pattern with this name already exists",
        });
      }

      neckPattern.name =
        trimmedName;

      // Regenerate slug

      neckPattern.slug =
        await createUniqueSlug(
          trimmedName,
          id
        );
    }

    // ------------------------------------------------------
    // DESCRIPTION
    // ------------------------------------------------------

    if (description !== undefined) {
      neckPattern.description =
        description.trim();
    }

    // ------------------------------------------------------
    // STATUS
    // ------------------------------------------------------

    if (status !== undefined) {
      if (
        !["active", "inactive"].includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      neckPattern.status =
        status;
    }

    // ------------------------------------------------------
    // IMAGE
    // ------------------------------------------------------

    if (req.file) {
      const oldImage =
        neckPattern.image;

      neckPattern.image =
        `/uploads/neck-patterns/${req.file.filename}`;

      // Delete old image

      if (oldImage) {
        deleteImage(oldImage);
      }
    }

    // ------------------------------------------------------
    // AUDIT
    // ------------------------------------------------------

    neckPattern.updatedBy =
      getUserId(req);

    await neckPattern.save();

    return res.status(200).json({
      success: true,
      message:
        "Neck pattern updated successfully",
      data: neckPattern,
    });
  } catch (error) {
    console.error(
      "Update neck pattern error:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Neck pattern with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update neck pattern",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE NECK PATTERN
// ==========================================================

exports.deleteNeckPattern = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    // ------------------------------------------------------
    // VALIDATE OBJECT ID
    // ------------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid neck pattern ID",
      });
    }

    // ------------------------------------------------------
    // FIND
    // ------------------------------------------------------

    const neckPattern =
      await NeckPattern.findById(id);

    if (!neckPattern) {
      return res.status(404).json({
        success: false,
        message: "Neck pattern not found",
      });
    }

    // ------------------------------------------------------
    // DELETE IMAGE
    // ------------------------------------------------------

    if (neckPattern.image) {
      deleteImage(
        neckPattern.image
      );
    }

    // ------------------------------------------------------
    // DELETE
    // ------------------------------------------------------

    await NeckPattern.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Neck pattern deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete neck pattern error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete neck pattern",
      error: error.message,
    });
  }
};