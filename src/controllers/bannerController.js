
const Banner = require("../models/bannerModel");
const fs = require("fs");
const path = require("path");

// ==========================================================
// CREATE BANNER
// POST /api/banners
// ==========================================================
const createBanner = async (req, res) => {
  try {
    const { bannerType } = req.body;

    // Validate banner type
    if (!bannerType) {
      return res.status(400).json({
        success: false,
        message: "bannerType is required",
      });
    }

    if (!["offer", "festival", "dailyUsage"].includes(bannerType)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid bannerType. Allowed values: offer, festival, dailyUsage",
      });
    }

    // Validate image
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    // Create image URL
    const imageURL = `/uploads/banners/${req.file.filename}`;

    const banner = await Banner.create({
      bannerType,
      imageURL,
    });

    return res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner,
    });
  } catch (error) {
    console.error("CREATE BANNER ERROR:", error);

    // Delete uploaded image if database operation fails
    if (req.file) {
      const filePath = path.join(
        process.cwd(),
        "uploads/banners",
        req.file.filename
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create banner",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL BANNERS
// GET /api/banners
// ==========================================================
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find();

    return res.status(200).json({
      success: true,
      message: "Banners fetched successfully",
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    console.error("GET ALL BANNERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      error: error.message,
    });
  }
};

// ==========================================================
// GET SINGLE BANNER
// GET /api/banners/:id
// ==========================================================
const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Banner fetched successfully",
      data: banner,
    });
  } catch (error) {
    console.error("GET BANNER BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banner",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE BANNER
// PUT /api/banners/:id
// ==========================================================
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { bannerType } = req.body;

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Validate banner type if provided
    if (
      bannerType &&
      !["offer", "festival", "dailyUsage"].includes(bannerType)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid bannerType. Allowed values: offer, festival, dailyUsage",
      });
    }

    // Keep old image initially
    const oldImageURL = banner.imageURL;

    // Update banner type
    if (bannerType) {
      banner.bannerType = bannerType;
    }

    // If new image uploaded
    if (req.file) {
      banner.imageURL = `/uploads/banners/${req.file.filename}`;
    }

    banner.updatedAt = new Date();

    await banner.save();

    // Delete old image after successful database update
    if (req.file && oldImageURL) {
      const oldFilePath = path.join(
        process.cwd(),
        oldImageURL.replace(/^\/+/, "")
      );

      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: banner,
    });
  } catch (error) {
    console.error("UPDATE BANNER ERROR:", error);

    // Delete newly uploaded image if update fails
    if (req.file) {
      const filePath = path.join(
        process.cwd(),
        "uploads/banners",
        req.file.filename
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update banner",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE BANNER
// DELETE /api/banners/:id
// ==========================================================
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Delete image from uploads folder
    if (banner.imageURL) {
      const imagePath = path.join(
        process.cwd(),
        banner.imageURL.replace(/^\/+/, "")
      );

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Banner.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("DELETE BANNER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete banner",
      error: error.message,
    });
  }
};

const  getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.find({
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    console.error("GET ACTIVE BANNERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch active banners",
      error: error.message,
    });
  }
};

module.exports = {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
  getActiveBanners,
};


