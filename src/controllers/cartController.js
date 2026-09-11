const mongoose = require("mongoose");

const Cart = require("../models/cartModel");
const Product = require("../models/productModel");
const ProductVariant = require("../models/productVariantModel");

// ==========================================================
// HELPER: RECALCULATE CART TOTALS
// ==========================================================

const calculateCartTotals = (cart) => {
  let totalItems = 0;
  let totalAmount = 0;

  cart.items.forEach((item) => {
    totalItems += item.quantity;
    totalAmount += item.quantity * item.price;
  });

  cart.totalItems = totalItems;
  cart.totalAmount = totalAmount;
};

// ==========================================================
// ADD TO CART
// POST /api/cart/add
// ==========================================================

exports.addToCart = async (req, res) => {
  try {
    const userId = req.user?.id;

    const {
      productId,
      variantId,
      quantity = 1,
    } = req.body;

    // ------------------------------------------------------
    // AUTH CHECK
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
    // VALIDATE QUANTITY
    // ------------------------------------------------------

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    // ------------------------------------------------------
    // FIND PRODUCT
    // ------------------------------------------------------

    const product = await Product.findOne({
      _id: productId,
      status: {
        $ne: "inactive",
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ------------------------------------------------------
    // FIND VARIANT
    // ------------------------------------------------------

    const variant = await ProductVariant.findOne({
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
    // CHECK STOCK
    // ------------------------------------------------------

    const availableStock = Number(
      variant.stock || 0
    );

    if (availableStock <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    // ------------------------------------------------------
    // FIND ACTIVE CART
    // ------------------------------------------------------

    let cart = await Cart.findOne({
      user: userId,
      status: "active",
    });

    // ------------------------------------------------------
    // CREATE CART IF NOT EXISTS
    // ------------------------------------------------------

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
      });
    }

    // ------------------------------------------------------
    // CHECK WHETHER SAME VARIANT ALREADY EXISTS
    // ------------------------------------------------------

    const existingItem = cart.items.find(
      (item) =>
        item.variant.toString() ===
        variantId.toString()
    );

    // ======================================================
    // SAME PRODUCT VARIANT
    // ======================================================

    if (existingItem) {
      const newQuantity =
        existingItem.quantity + quantity;

      // ----------------------------------------------------
      // STOCK CHECK
      // ----------------------------------------------------

      if (newQuantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableStock} items available in stock`,
          availableStock,
          currentQuantity:
            existingItem.quantity,
        });
      }

      existingItem.quantity = newQuantity;

      // Update latest price if required
      existingItem.price =
        Number(variant.salePrice ?? variant.price ?? 0);

      // ====================================================
      // RECALCULATE
      // ====================================================

      calculateCartTotals(cart);

      await cart.save();

      return res.status(200).json({
        success: true,
        message: "Product quantity increased in cart",
        cart,
      });
    }

    // ======================================================
    // DIFFERENT PRODUCT VARIANT
    // ======================================================

    if (quantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} items available in stock`,
        availableStock,
      });
    }

    // ------------------------------------------------------
    // GET PRODUCT IMAGE
    // ------------------------------------------------------

    let productImage = "";

    if (
      Array.isArray(product.images) &&
      product.images.length > 0
    ) {
      const firstImage = product.images[0];

      if (typeof firstImage === "string") {
        productImage = firstImage;
      } else {
        productImage =
          firstImage.url ||
          firstImage.imageUrl ||
          "";
      }
    }

    // ------------------------------------------------------
    // GET SIZE
    // ------------------------------------------------------

    let sizeName = "";

    if (variant.size) {
      if (
        typeof variant.size === "object"
      ) {
        sizeName =
          variant.size.name || "";
      } else {
        sizeName = variant.size.toString();
      }
    }

    // ------------------------------------------------------
    // GET COLOR
    // ------------------------------------------------------

    let colorName = "";

    if (variant.color) {
      if (
        typeof variant.color === "object"
      ) {
        colorName =
          variant.color.name || "";
      } else {
        colorName = variant.color.toString();
      }
    }

    // ------------------------------------------------------
    // GET PRICE
    // ------------------------------------------------------

    const itemPrice = Number(
      variant.salePrice ??
        variant.price ??
        product.salePrice ??
        product.price ??
        0
    );

    // ------------------------------------------------------
    // ADD NEW ITEM
    // ------------------------------------------------------

    cart.items.push({
      product: product._id,
      variant: variant._id,

      quantity,

      price: itemPrice,

      productName:
        product.name ||
        product.productName ||
        "",

      image: productImage,

      size: sizeName,

      color: colorName,
    });

    // ------------------------------------------------------
    // RECALCULATE CART
    // ------------------------------------------------------

    calculateCartTotals(cart);

    await cart.save();

    // ------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Product added to cart",
      cart,
    });
  } catch (error) {
    console.error(
      "ADD TO CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
      error: error.message,
    });
  }
};

// ==========================================================
// GET CART
// GET /api/cart
// ==========================================================

exports.getCart = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const cart = await Cart.findOne({
      user: userId,
      status: "active",
    })
      .populate({
        path: "items.product",
      })
      .populate({
        path: "items.variant",
      });

    // ------------------------------------------------------
    // EMPTY CART
    // ------------------------------------------------------

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        cart: {
          items: [],
          totalItems: 0,
          totalAmount: 0,
        },
      });
    }

    return res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    console.error(
      "GET CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get cart",
      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE CART ITEM QUANTITY
// PUT /api/cart/item/:itemId
// ==========================================================

exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

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
        message: "Invalid cart item ID",
      });
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const cart = await Cart.findOne({
      user: userId,
      status: "active",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    // ------------------------------------------------------
    // CHECK VARIANT STOCK
    // ------------------------------------------------------

    const variant =
      await ProductVariant.findById(
        item.variant
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const availableStock =
      Number(variant.stock || 0);

    if (quantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} items available`,
        availableStock,
      });
    }

    item.quantity = quantity;

    calculateCartTotals(cart);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart quantity updated",
      cart,
    });
  } catch (error) {
    console.error(
      "UPDATE CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update cart",
      error: error.message,
    });
  }
};

// ==========================================================
// REMOVE CART ITEM
// DELETE /api/cart/item/:itemId
// ==========================================================

exports.removeCartItem = async (req, res) => {
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
        message: "Invalid cart item ID",
      });
    }

    const cart = await Cart.findOne({
      user: userId,
      status: "active",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    item.deleteOne();

    calculateCartTotals(cart);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from cart",
      cart,
    });
  } catch (error) {
    console.error(
      "REMOVE CART ITEM ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to remove cart item",
      error: error.message,
    });
  }
};

// ==========================================================
// INCREASE CART ITEM
// PATCH /api/cart/item/:itemId/increase
// ==========================================================

exports.increaseCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({
      user: userId,
      status: "active",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    const variant =
      await ProductVariant.findById(
        item.variant
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const stock =
      Number(variant.stock || 0);

    if (item.quantity + 1 > stock) {
      return res.status(400).json({
        success: false,
        message: "Maximum available stock reached",
        availableStock: stock,
      });
    }

    item.quantity += 1;

    calculateCartTotals(cart);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart quantity increased",
      cart,
    });
  } catch (error) {
    console.error(
      "INCREASE CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to increase quantity",
      error: error.message,
    });
  }
};

// ==========================================================
// DECREASE CART ITEM
// PATCH /api/cart/item/:itemId/decrease
// ==========================================================

exports.decreaseCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({
      user: userId,
      status: "active",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    if (item.quantity > 1) {
      item.quantity -= 1;
    } else {
      item.deleteOne();
    }

    calculateCartTotals(cart);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated",
      cart,
    });
  } catch (error) {
    console.error(
      "DECREASE CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to decrease quantity",
      error: error.message,
    });
  }
};

// ==========================================================
// CLEAR CART
// DELETE /api/cart/clear
// ==========================================================

exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;

    const cart = await Cart.findOne({
      user: userId,
      status: "active",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = [];

    cart.totalItems = 0;
    cart.totalAmount = 0;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      cart,
    });
  } catch (error) {
    console.error(
      "CLEAR CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};