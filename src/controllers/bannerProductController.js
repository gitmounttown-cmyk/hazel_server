const mongoose = require("mongoose");

const BannerProduct = require("../models/bannerProductModel");
const Banner = require("../models/bannerModel");
const Product = require("../models/productModel");

// ==========================================================
// CREATE BANNER PRODUCT
// ==========================================================

const createBannerProduct = async (req, res) => {
  try {
    const { bannerId, productId } = req.body;

    // Validate required fields
    if (!bannerId) {
      return res.status(400).json({
        success: false,
        message: "bannerId is required",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required",
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(bannerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bannerId",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId",
      });
    }

    // Check banner exists
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Check product exists
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Prevent duplicate banner-product mapping
    const existingBannerProduct = await BannerProduct.findOne({
      bannerId,
      productId,
    });

    if (existingBannerProduct) {
      return res.status(409).json({
        success: false,
        message: "Product is already assigned to this banner",
      });
    }

    // Create mapping
    const bannerProduct = await BannerProduct.create({
      bannerId,
      productId,
    });

    // Populate response
    const populatedBannerProduct =
      await BannerProduct.findById(bannerProduct._id)
        .populate("bannerId")
        .populate("productId");

    return res.status(201).json({
      success: true,
      message: "Product assigned to banner successfully",
      data: populatedBannerProduct,
    });
  } catch (error) {
    console.error("Create Banner Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign product to banner",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL BANNER PRODUCTS
// ==========================================================

const getAllBannerProducts = async (req, res) => {
  try {
    const bannerProducts = await BannerProduct.find()
      .populate("bannerId")
      .populate("productId");

    return res.status(200).json({
      success: true,
      count: bannerProducts.length,
      data: bannerProducts,
    });
  } catch (error) {
    console.error("Get All Banner Products Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banner products",
      error: error.message,
    });
  }
};

// ==========================================================
// GET BANNER PRODUCT BY ID
// ==========================================================

const getBannerProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner product ID",
      });
    }

    const bannerProduct = await BannerProduct.findById(id)
      .populate("bannerId")
      .populate("productId");

    if (!bannerProduct) {
      return res.status(404).json({
        success: false,
        message: "Banner product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: bannerProduct,
    });
  } catch (error) {
    console.error("Get Banner Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banner product",
      error: error.message,
    });
  }
};

// ==========================================================
// GET PRODUCTS BY BANNER ID
// ==========================================================

const getProductsByBannerId = async (req, res) => {
  try {
    const { bannerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bannerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bannerId",
      });
    }

    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    const bannerProducts = await BannerProduct.find({
      bannerId,
    })
      .populate("bannerId")
      .populate("productId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      bannerId,
      count: bannerProducts.length,
      data: bannerProducts,
    });
  } catch (error) {
    console.error("Get Products By Banner Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products for banner",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE BANNER PRODUCT
// ==========================================================

const updateBannerProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { bannerId, productId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner product ID",
      });
    }

    if (!bannerId && !productId) {
      return res.status(400).json({
        success: false,
        message: "At least bannerId or productId is required",
      });
    }

    // Check banner if provided
    if (bannerId) {
      if (!mongoose.Types.ObjectId.isValid(bannerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bannerId",
        });
      }

      const banner = await Banner.findById(bannerId);

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: "Banner not found",
        });
      }
    }

    // Check product if provided
    if (productId) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid productId",
        });
      }

      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }
    }

    const existing = await BannerProduct.findById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Banner product not found",
      });
    }

    const newBannerId = bannerId || existing.bannerId;
    const newProductId = productId || existing.productId;

    // Prevent duplicate mapping
    const duplicate = await BannerProduct.findOne({
      _id: { $ne: id },
      bannerId: newBannerId,
      productId: newProductId,
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "This product is already assigned to this banner",
      });
    }

    const updatedBannerProduct =
      await BannerProduct.findByIdAndUpdate(
        id,
        {
          bannerId: newBannerId,
          productId: newProductId,
          updatedAt: new Date(),
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("bannerId")
        .populate("productId");

    return res.status(200).json({
      success: true,
      message: "Banner product updated successfully",
      data: updatedBannerProduct,
    });
  } catch (error) {
    console.error("Update Banner Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update banner product",
      error: error.message,
    });
  }
};

// ==========================================================
// DELETE BANNER PRODUCT
// ==========================================================

const deleteBannerProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner product ID",
      });
    }

    const bannerProduct =
      await BannerProduct.findByIdAndDelete(id);

    if (!bannerProduct) {
      return res.status(404).json({
        success: false,
        message: "Banner product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product removed from banner successfully",
      data: bannerProduct,
    });
  } catch (error) {
    console.error("Delete Banner Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove product from banner",
      error: error.message,
    });
  }
};

// ==========================================================
// EXPORT CONTROLLERS
// ==========================================================

module.exports = {
  createBannerProduct,
  getAllBannerProducts,
  getBannerProductById,
  getProductsByBannerId,
  updateBannerProduct,
  deleteBannerProduct,
};