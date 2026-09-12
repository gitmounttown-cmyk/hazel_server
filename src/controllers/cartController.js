const mongoose = require("mongoose");

const Cart = require("../models/cartModel");
const Product = require("../models/productModel");

// ============================================================
// GET CART ITEM PRICE
// ============================================================

const getSellingPrice = (item) => {
  const price = Number(item.price);
  const discountPrice = Number(item.discountPrice);

  // ----------------------------------------------------------
  // Use discount price when available
  // ----------------------------------------------------------

  if (
    Number.isFinite(discountPrice) &&
    discountPrice > 0 &&
    discountPrice < price
  ) {
    return discountPrice;
  }

  // ----------------------------------------------------------
  // Otherwise use original price
  // ----------------------------------------------------------

  if (
    Number.isFinite(price) &&
    price >= 0
  ) {
    return price;
  }

  return null;
};

// ============================================================
// CALCULATE CART TOTALS
// ============================================================

const calculateCartTotals = (cart) => {
  let totalItems = 0;
  let totalAmount = 0;

  // ----------------------------------------------------------
  // Loop Cart Items
  // ----------------------------------------------------------

  for (const item of cart.items) {
    const price = Number(item.price);

    const discountPrice = Number(
      item.discountPrice
    );

    const quantity = Number(
      item.quantity
    );

    // --------------------------------------------------------
    // Validate Price
    // --------------------------------------------------------

    if (!Number.isFinite(price) || price < 0) {
      throw new Error(
        `Invalid price for cart item ${item._id}`
      );
    }

    // --------------------------------------------------------
    // Validate Discount Price
    // --------------------------------------------------------

    if (
      !Number.isFinite(discountPrice) ||
      discountPrice < 0
    ) {
      throw new Error(
        `Invalid discount price for cart item ${item._id}`
      );
    }

    // --------------------------------------------------------
    // Validate Quantity
    // --------------------------------------------------------

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new Error(
        `Invalid quantity for cart item ${item._id}`
      );
    }

    // --------------------------------------------------------
    // Determine Selling Price
    // --------------------------------------------------------

    const sellingPrice = getSellingPrice(item);

    if (sellingPrice === null) {
      throw new Error(
        `Unable to calculate selling price for cart item ${item._id}`
      );
    }

    // --------------------------------------------------------
    // Calculate
    // --------------------------------------------------------

    totalItems += quantity;

    totalAmount +=
      sellingPrice * quantity;
  }

  // ----------------------------------------------------------
  // Save Totals
  // ----------------------------------------------------------

  cart.totalItems = totalItems;

  cart.totalAmount = Number(
    totalAmount.toFixed(2)
  );

  return cart;
};

// ============================================================
// ADD PRODUCT TO CART
// POST /api/cart/add
// ============================================================

const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      productId,
      quantity = 1,
      price,
      discountPrice,
    } = req.body;

    // --------------------------------------------------------
    // Validate Product ID
    // --------------------------------------------------------

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // --------------------------------------------------------
    // Validate Quantity
    // --------------------------------------------------------

    const requestedQuantity =
      Number(quantity);

    if (
      !Number.isInteger(
        requestedQuantity
      ) ||
      requestedQuantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be a positive integer",
      });
    }

    // --------------------------------------------------------
    // Validate Price
    // --------------------------------------------------------

    const originalPrice = Number(price);

    if (
      !Number.isFinite(originalPrice) ||
      originalPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid price is required",
      });
    }

    // --------------------------------------------------------
    // Validate Discount Price
    // --------------------------------------------------------

    const finalDiscountPrice =
      discountPrice === undefined ||
      discountPrice === null ||
      discountPrice === ""
        ? 0
        : Number(discountPrice);

    if (
      !Number.isFinite(
        finalDiscountPrice
      ) ||
      finalDiscountPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid discountPrice is required",
      });
    }

    // --------------------------------------------------------
    // Discount cannot be greater than original price
    // --------------------------------------------------------

    if (
      finalDiscountPrice > originalPrice
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Discount price cannot be greater than price",
      });
    }

    // --------------------------------------------------------
    // Find Product
    // --------------------------------------------------------

    const product =
      await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // --------------------------------------------------------
    // Find Active Cart
    // --------------------------------------------------------

    let cart = await Cart.findOne({
      user: userId,
      status: "active",
    });

    // ========================================================
    // CREATE CART
    // ========================================================

    if (!cart) {
      cart = new Cart({
        user: userId,

        items: [
          {
            product: productId,

            quantity:
              requestedQuantity,

            price:
              originalPrice,

            discountPrice:
              finalDiscountPrice,
          },
        ],

        totalItems: 0,

        totalAmount: 0,

        status: "active",
      });
    }

    // ========================================================
    // EXISTING CART
    // ========================================================

    else {
      const existingItem =
        cart.items.find(
          (item) =>
            item.product.toString() ===
            productId.toString()
        );

      // ------------------------------------------------------
      // Product Already Exists
      // ------------------------------------------------------

      if (existingItem) {
        existingItem.quantity +=
          requestedQuantity;

        // Update price snapshot
        existingItem.price =
          originalPrice;

        existingItem.discountPrice =
          finalDiscountPrice;
      }

      // ------------------------------------------------------
      // New Product
      // ------------------------------------------------------

      else {
        cart.items.push({
          product: productId,

          quantity:
            requestedQuantity,

          price:
            originalPrice,

          discountPrice:
            finalDiscountPrice,
        });
      }
    }

    // --------------------------------------------------------
    // Calculate Cart Totals
    // --------------------------------------------------------

    calculateCartTotals(cart);

    // --------------------------------------------------------
    // Save
    // --------------------------------------------------------

    await cart.save();

    // --------------------------------------------------------
    // Populate Product
    // --------------------------------------------------------

    await cart.populate({
      path: "items.product",
    });

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Product added to cart successfully",

      cart,
    });
  } catch (error) {
    console.error(
      "ADD TO CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to add product to cart",

      error: error.message,
    });
  }
};

// ============================================================
// GET CART
// GET /api/cart/all
// ============================================================

const getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart =
      await Cart.findOne({
        user: userId,
        status: "active",
      }).populate(
        "items.product"
      );

    // --------------------------------------------------------
    // Empty Cart
    // --------------------------------------------------------

    if (!cart) {
      return res.status(200).json({
        success: true,

        message: "Cart is empty",

        cart: {
          user: userId,

          items: [],

          totalItems: 0,

          totalAmount: 0,

          status: "active",
        },
      });
    }

    // --------------------------------------------------------
    // Recalculate
    // --------------------------------------------------------

    calculateCartTotals(cart);

    await cart.save();

    // --------------------------------------------------------
    // Populate
    // --------------------------------------------------------

    await cart.populate(
      "items.product"
    );

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Cart fetched successfully",

      cart,
    });
  } catch (error) {
    console.error(
      "GET CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch cart",

      error: error.message,
    });
  }
};

// ============================================================
// UPDATE CART QUANTITY
// PUT /api/cart/update/:itemId
// ============================================================

const updateCartQuantity = async (
  req,
  res
) => {
  try {
    const userId = req.user._id;

    const { itemId } =
      req.params;

    const { quantity } =
      req.body;

    // --------------------------------------------------------
    // Validate Item ID
    // --------------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(
        itemId
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid cart item ID",
      });
    }

    // --------------------------------------------------------
    // Validate Quantity
    // --------------------------------------------------------

    const newQuantity =
      Number(quantity);

    if (
      !Number.isInteger(
        newQuantity
      ) ||
      newQuantity < 1
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Quantity must be a positive integer",
      });
    }

    // --------------------------------------------------------
    // Find Cart
    // --------------------------------------------------------

    const cart =
      await Cart.findOne({
        user: userId,
        status: "active",
      });

    if (!cart) {
      return res.status(404).json({
        success: false,

        message:
          "Cart not found",
      });
    }

    // --------------------------------------------------------
    // Find Item
    // --------------------------------------------------------

    const cartItem =
      cart.items.id(itemId);

    if (!cartItem) {
      return res.status(404).json({
        success: false,

        message:
          "Cart item not found",
      });
    }

    // --------------------------------------------------------
    // Update Quantity
    // --------------------------------------------------------

    cartItem.quantity =
      newQuantity;

    // --------------------------------------------------------
    // Calculate
    // --------------------------------------------------------

    calculateCartTotals(cart);

    await cart.save();

    // --------------------------------------------------------
    // Populate
    // --------------------------------------------------------

    await cart.populate(
      "items.product"
    );

    return res.status(200).json({
      success: true,

      message:
        "Cart quantity updated successfully",

      cart,
    });
  } catch (error) {
    console.error(
      "UPDATE CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to update cart quantity",

      error: error.message,
    });
  }
};

// ============================================================
// REMOVE CART ITEM
// DELETE /api/cart/remove/:itemId
// ============================================================

const removeFromCart = async (
  req,
  res
) => {
  try {
    const userId = req.user._id;

    const { itemId } =
      req.params;

    // --------------------------------------------------------
    // Validate Item ID
    // --------------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(
        itemId
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid cart item ID",
      });
    }

    // --------------------------------------------------------
    // Find Cart
    // --------------------------------------------------------

    const cart =
      await Cart.findOne({
        user: userId,
        status: "active",
      });

    if (!cart) {
      return res.status(404).json({
        success: false,

        message:
          "Cart not found",
      });
    }

    // --------------------------------------------------------
    // Find Item
    // --------------------------------------------------------

    const cartItem =
      cart.items.id(itemId);

    if (!cartItem) {
      return res.status(404).json({
        success: false,

        message:
          "Cart item not found",
      });
    }

    // --------------------------------------------------------
    // Remove
    // --------------------------------------------------------

    cart.items.pull(itemId);

    // --------------------------------------------------------
    // Calculate
    // --------------------------------------------------------

    calculateCartTotals(cart);

    await cart.save();

    // --------------------------------------------------------
    // Populate
    // --------------------------------------------------------

    await cart.populate(
      "items.product"
    );

    return res.status(200).json({
      success: true,

      message:
        "Product removed from cart successfully",

      cart,
    });
  } catch (error) {
    console.error(
      "REMOVE CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to remove product from cart",

      error: error.message,
    });
  }
};

// ============================================================
// CLEAR CART
// DELETE /api/cart/clear
// ============================================================

const clearCart = async (
  req,
  res
) => {
  try {
    const userId = req.user._id;

    const cart =
      await Cart.findOne({
        user: userId,
        status: "active",
      });

    if (!cart) {
      return res.status(404).json({
        success: false,

        message:
          "Cart not found",
      });
    }

    // --------------------------------------------------------
    // Clear
    // --------------------------------------------------------

    cart.items = [];

    cart.totalItems = 0;

    cart.totalAmount = 0;

    await cart.save();

    return res.status(200).json({
      success: true,

      message:
        "Cart cleared successfully",

      cart,
    });
  } catch (error) {
    console.error(
      "CLEAR CART ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to clear cart",

      error: error.message,
    });
  }
};

// ============================================================
// GET CART COUNT
// GET /api/cart/count
// ============================================================

const getCartCount = async (
  req,
  res
) => {
  try {
    const userId = req.user._id;

    const cart =
      await Cart.findOne({
        user: userId,
        status: "active",
      });

    if (!cart) {
      return res.status(200).json({
        success: true,

        count: 0,
      });
    }

    return res.status(200).json({
      success: true,

      count:
        cart.totalItems || 0,
    });
  } catch (error) {
    console.error(
      "GET CART COUNT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to get cart count",

      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  addToCart,
  getCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
};