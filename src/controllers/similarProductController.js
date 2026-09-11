const SimilarProduct = require("../models/similarProductModel");

// ==========================================
// CREATE SIMILAR PRODUCT
// ==========================================
exports.createSimilarProduct = async (req, res) => {
  try {
    const { productId, similarProductId } = req.body;

    if (!productId || !similarProductId) {
      return res.status(400).json({
        success: false,
        message: "productId and similarProductId are required",
      });
    }

    // Prevent product from being similar to itself
    if (productId === similarProductId) {
      return res.status(400).json({
        success: false,
        message: "A product cannot be similar to itself",
      });
    }

    // Check duplicate
    const existingSimilarProduct = await SimilarProduct.findOne({
      productId,
      similarProductId,
    });

    if (existingSimilarProduct) {
      return res.status(409).json({
        success: false,
        message: "This similar product already exists",
      });
    }

    const similarProduct = await SimilarProduct.create({
      productId,
      similarProductId,
    });

    const populatedProduct = await SimilarProduct.findById(
      similarProduct._id
    )
      .populate("productId")
      .populate("similarProductId");

    return res.status(201).json({
      success: true,
      message: "Similar product added successfully",
      data: populatedProduct,
    });
  } catch (error) {
    console.error("Create Similar Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create similar product",
      error: error.message,
    });
  }
};

// ==========================================
// GET ALL SIMILAR PRODUCTS
// ==========================================
exports.getAllSimilarProducts = async (req, res) => {
  try {
    const similarProducts = await SimilarProduct.find()
      .populate("productId")
      .populate("similarProductId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: similarProducts.length,
      data: similarProducts,
    });
  } catch (error) {
    console.error("Get Similar Products Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch similar products",
      error: error.message,
    });
  }
};

// ==========================================
// GET SIMILAR PRODUCTS BY PRODUCT ID
// ==========================================
exports.getSimilarProductsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const similarProducts = await SimilarProduct.find({
      productId,
    })
      .populate("similarProductId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: similarProducts.length,
      data: similarProducts,
    });
  } catch (error) {
    console.error("Get Similar Products By Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch similar products",
      error: error.message,
    });
  }
};

// ==========================================
// GET SINGLE SIMILAR PRODUCT
// ==========================================
exports.getSimilarProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const similarProduct = await SimilarProduct.findById(id)
      .populate("productId")
      .populate("similarProductId");

    if (!similarProduct) {
      return res.status(404).json({
        success: false,
        message: "Similar product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: similarProduct,
    });
  } catch (error) {
    console.error("Get Similar Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch similar product",
      error: error.message,
    });
  }
};

// ==========================================
// UPDATE SIMILAR PRODUCT
// ==========================================
exports.updateSimilarProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, similarProductId } = req.body;

    if (!productId || !similarProductId) {
      return res.status(400).json({
        success: false,
        message: "productId and similarProductId are required",
      });
    }

    if (productId === similarProductId) {
      return res.status(400).json({
        success: false,
        message: "A product cannot be similar to itself",
      });
    }

    // Check duplicate excluding current record
    const duplicate = await SimilarProduct.findOne({
      productId,
      similarProductId,
      _id: { $ne: id },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "This similar product already exists",
      });
    }

    const updatedSimilarProduct = await SimilarProduct.findByIdAndUpdate(
      id,
      {
        productId,
        similarProductId,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("productId")
      .populate("similarProductId");

    if (!updatedSimilarProduct) {
      return res.status(404).json({
        success: false,
        message: "Similar product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Similar product updated successfully",
      data: updatedSimilarProduct,
    });
  } catch (error) {
    console.error("Update Similar Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update similar product",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE SIMILAR PRODUCT
// ==========================================
exports.deleteSimilarProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const similarProduct = await SimilarProduct.findByIdAndDelete(id);

    if (!similarProduct) {
      return res.status(404).json({
        success: false,
        message: "Similar product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Similar product deleted successfully",
    });
  } catch (error) {
    console.error("Delete Similar Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete similar product",
      error: error.message,
    });
  }
};