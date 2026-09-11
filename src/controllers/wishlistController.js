const mongoose = require("mongoose");

const Wishlist = require("../models/wishlistModel");
const Product = require("../models/productModel");
const ProductVariant = require("../models/productVariantModel");

// ==========================================================
// ADD TO WISHLIST
// POST /api/wishlist/add
// ==========================================================

exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.user?.id;

    const {
      productId,
      variantId,
    } = req.body;

    // ------------------------------------------------------
    // AUTHENTICATION
    // ------------------------------------------------------

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ------------------------------------------------------
    // VALIDATE PRODUCT ID
    // ------------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // ------------------------------------------------------
    // VALIDATE VARIANT ID
    // ------------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(variantId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    // ------------------------------------------------------
    // FIND PRODUCT
    // ------------------------------------------------------

    const product = await Product.findById(
      productId
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ------------------------------------------------------
    // FIND VARIANT
    // ------------------------------------------------------

    const variant =
      await ProductVariant.findOne({
        _id: variantId,
        product: productId,
      });

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    // ------------------------------------------------------
    // FIND USER WISHLIST
    // ------------------------------------------------------

    let wishlist =
      await Wishlist.findOne({
        user: userId,
        status: "active",
      });

    // ------------------------------------------------------
    // CREATE WISHLIST
    // ------------------------------------------------------

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        items: [],
      });
    }

    // ------------------------------------------------------
    // CHECK DUPLICATE VARIANT
    // ------------------------------------------------------

    const existingItem =
      wishlist.items.find(
        (item) =>
          item.variant.toString() ===
          variantId.toString()
      );

    if (existingItem) {
      return res.status(200).json({
        success: true,
        message: "Product already exists in wishlist",
        wishlist,
      });
    }

    // ------------------------------------------------------
    // PRODUCT IMAGE
    // ------------------------------------------------------

    let productImage = "";

    if (
      Array.isArray(product.images) &&
      product.images.length > 0
    ) {
      const firstImage = product.images[0];

      if (
        typeof firstImage === "string"
      ) {
        productImage = firstImage;
      } else {
        productImage =
          firstImage.url ||
          firstImage.imageUrl ||
          "";
      }
    }

    // ------------------------------------------------------
    // SIZE
    // ------------------------------------------------------

    let sizeName = "";

    if (variant.size) {
      if (
        typeof variant.size === "object"
      ) {
        sizeName =
          variant.size.name || "";
      } else {
        sizeName =
          variant.size.toString();
      }
    }

    // ------------------------------------------------------
    // COLOR
    // ------------------------------------------------------

    let colorName = "";

    if (variant.color) {
      if (
        typeof variant.color === "object"
      ) {
        colorName =
          variant.color.name || "";
      } else {
        colorName =
          variant.color.toString();
      }
    }

    // ------------------------------------------------------
    // PRICE
    // ------------------------------------------------------

    const price = Number(
      variant.salePrice ??
        variant.price ??
        product.salePrice ??
        product.price ??
        0
    );

    // ------------------------------------------------------
    // ADD WISHLIST ITEM
    // ------------------------------------------------------

    wishlist.items.push({
      product: product._id,
      variant: variant._id,
      price,
      productName:
        product.name ||
        product.productName ||
        "",
      image: productImage,
      size: sizeName,
      color: colorName,
    });

    await wishlist.save();

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist",
      wishlist,
    });
  } catch (error) {
    console.error(
      "ADD WISHLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
      error: error.message,
    });
  }
};

// ==========================================================
// GET WISHLIST
// GET /api/wishlist
// ==========================================================

exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const wishlist =
      await Wishlist.findOne({
        user: userId,
        status: "active",
      })
        .populate("items.product")
        .populate("items.variant");

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        message: "Wishlist is empty",
        wishlist: {
          items: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      wishlist,
    });
  } catch (error) {
    console.error(
      "GET WISHLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get wishlist",
      error: error.message,
    });
  }
};

// ==========================================================
// REMOVE WISHLIST ITEM
// DELETE /api/wishlist/item/:itemId
// ==========================================================

exports.removeWishlistItem = async (
  req,
  res
) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid wishlist item ID",
      });
    }

    const wishlist =
      await Wishlist.findOne({
        user: userId,
        status: "active",
      });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const item =
      wishlist.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Wishlist item not found",
      });
    }

    item.deleteOne();

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      wishlist,
    });
  } catch (error) {
    console.error(
      "REMOVE WISHLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to remove wishlist item",
      error: error.message,
    });
  }
};

// ==========================================================
// REMOVE BY PRODUCT VARIANT
// DELETE /api/wishlist/variant/:variantId
// ==========================================================

exports.removeByVariant = async (
  req,
  res
) => {
  try {
    const userId = req.user?.id;
    const { variantId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        variantId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant ID",
      });
    }

    const wishlist =
      await Wishlist.findOne({
        user: userId,
        status: "active",
      });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const originalLength =
      wishlist.items.length;

    wishlist.items =
      wishlist.items.filter(
        (item) =>
          item.variant.toString() !==
          variantId.toString()
      );

    if (
      wishlist.items.length ===
      originalLength
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Product variant not found in wishlist",
      });
    }

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message:
        "Product removed from wishlist",
      wishlist,
    });
  } catch (error) {
    console.error(
      "REMOVE WISHLIST VARIANT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to remove product",
      error: error.message,
    });
  }
};

// ==========================================================
// CLEAR WISHLIST
// DELETE /api/wishlist/clear
// ==========================================================

exports.clearWishlist = async (
  req,
  res
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const wishlist =
      await Wishlist.findOne({
        user: userId,
        status: "active",
      });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    wishlist.items = [];

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message: "Wishlist cleared",
      wishlist,
    });
  } catch (error) {
    console.error(
      "CLEAR WISHLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to clear wishlist",
      error: error.message,
    });
  }
};