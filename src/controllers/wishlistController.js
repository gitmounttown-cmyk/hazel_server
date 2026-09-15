const mongoose = require("mongoose");

const Wishlist = require("../models/wishlistModel");
const Product = require("../models/productModel");

// ==========================================================
// ADD PRODUCT TO WISHLIST
// POST /api/wishlist/add
// ==========================================================

const addToWishlist = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { productId } = req.body;

    // ------------------------------------------------------
    // VALIDATE PRODUCT ID
    // ------------------------------------------------------

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // ------------------------------------------------------
    // CHECK PRODUCT EXISTS
    // ------------------------------------------------------

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ------------------------------------------------------
    // FIND USER WISHLIST
    // ------------------------------------------------------

    let wishlist = await Wishlist.findOne({
      user: userId,
    });

    // ------------------------------------------------------
    // CREATE WISHLIST IF NOT EXISTS
    // ------------------------------------------------------

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        items: [],
        status: "active",
      });
    }

    // ------------------------------------------------------
    // CHECK PRODUCT ALREADY EXISTS
    // ------------------------------------------------------

    const alreadyExists = wishlist.items.some(
      (item) => item.product.toString() === productId.toString(),
    );

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "Product already exists in wishlist",
      });
    }

    // ------------------------------------------------------
    // ADD PRODUCT ID
    // ------------------------------------------------------

    wishlist.items.push({
      product: productId,
    });

    await wishlist.save();

    // ------------------------------------------------------
    // POPULATE PRODUCT
    // ------------------------------------------------------

    await wishlist.populate({
      path: "items.product",
    });

    // ------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully",
      wishlist,
    });
  } catch (error) {
    console.error("ADD TO WISHLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
      error: error.message,
    });
  }
};

// ==========================================================
// GET USER WISHLIST
// GET /api/wishlist
// ==========================================================

const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    // ------------------------------------------------------
    // FIND WISHLIST AND POPULATE PRODUCT
    // ------------------------------------------------------

    const wishlist = await Wishlist.findOne({
      user: userId,
    }).populate({
      path: "items.product",
    });

    // ------------------------------------------------------
    // WISHLIST NOT FOUND
    // ------------------------------------------------------

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        message: "Wishlist is empty",
        wishlist: {
          user: userId,
          items: [],
          status: "active",
        },
        count: 0,
      });
    }

    // ------------------------------------------------------
    // REMOVE DELETED PRODUCTS
    // ------------------------------------------------------

    wishlist.items = wishlist.items.filter((item) => item.product !== null);

    // ------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Wishlist fetched successfully",
      wishlist,
      count: wishlist.items.length,
    });
  } catch (error) {
    console.error("GET WISHLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist",
      error: error.message,
    });
  }
};

// ==========================================================
// REMOVE PRODUCT FROM WISHLIST
// DELETE /api/wishlist/remove/:productId
// ==========================================================

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { productId } = req.params;

    // ------------------------------------------------------
    // VALIDATE PRODUCT ID
    // ------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // ------------------------------------------------------
    // FIND WISHLIST
    // ------------------------------------------------------

    const wishlist = await Wishlist.findOne({
      user: userId,
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // ------------------------------------------------------
    // CHECK PRODUCT EXISTS IN WISHLIST
    // ------------------------------------------------------

    const productExists = wishlist.items.some(
      (item) => item.product.toString() === productId.toString(),
    );

    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    // ------------------------------------------------------
    // REMOVE PRODUCT
    // ------------------------------------------------------

    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== productId.toString(),
    );

    await wishlist.save();

    // ------------------------------------------------------
    // POPULATE PRODUCT
    // ------------------------------------------------------

    await wishlist.populate({
      path: "items.product",
    });

    // ------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      wishlist,
      count: wishlist.items.length,
    });
  } catch (error) {
    console.error("REMOVE FROM WISHLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist",
      error: error.message,
    });
  }
};

// ==========================================================
// CHECK PRODUCT IN WISHLIST
// GET /api/wishlist/check/:productId
// ==========================================================

const checkWishlist = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { productId } = req.params;

    // ------------------------------------------------------
    // VALIDATE PRODUCT ID
    // ------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // ------------------------------------------------------
    // FIND WISHLIST
    // ------------------------------------------------------

    const wishlist = await Wishlist.findOne({
      user: userId,
    }).select("items");

    // ------------------------------------------------------
    // WISHLIST NOT FOUND
    // ------------------------------------------------------

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        isWishlisted: false,
      });
    }

    // ------------------------------------------------------
    // CHECK PRODUCT
    // ------------------------------------------------------

    const isWishlisted = wishlist.items.some(
      (item) => item.product.toString() === productId.toString(),
    );

    // ------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      isWishlisted,
    });
  } catch (error) {
    console.error("CHECK WISHLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check wishlist",
      error: error.message,
    });
  }
};

// ==========================================================
// CLEAR WISHLIST
// DELETE /api/wishlist/clear
// ==========================================================

const clearWishlist = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    // ------------------------------------------------------
    // FIND WISHLIST
    // ------------------------------------------------------

    const wishlist = await Wishlist.findOne({
      user: userId,
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // ------------------------------------------------------
    // CLEAR ITEMS
    // ------------------------------------------------------

    wishlist.items = [];

    await wishlist.save();

    // ------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Wishlist cleared successfully",
      wishlist,
      count: 0,
    });
  } catch (error) {
    console.error("CLEAR WISHLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to clear wishlist",
      error: error.message,
    });
  }
};

// ==========================================================
// GET WISHLIST COUNT
// GET /api/wishlist/count
// ==========================================================

const getWishlistCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    // ------------------------------------------------------
    // FIND WISHLIST
    // ------------------------------------------------------

    const wishlist = await Wishlist.findOne({
      user: userId,
    }).select("items");

    const count = wishlist ? wishlist.items.length : 0;

    // ------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("GET WISHLIST COUNT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get wishlist count",
      error: error.message,
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  checkWishlist,
  clearWishlist,
  getWishlistCount,
};
