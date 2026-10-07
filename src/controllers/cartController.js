const mongoose = require("mongoose");

const Cart = require("../models/cartModel");
const Product = require("../models/productModel");

// ============================================================
// HELPERS
// ============================================================

const getUserId = (req) => {
  return req.user?._id || req.user?.id;
};

const getVariant = (product, variantId) => {
  if (!product || !Array.isArray(product.variants)) {
    return null;
  }

  return product.variants.find(
    (variant) =>
      variant._id &&
      variant._id.toString() === variantId.toString()
  );
};

const calculateCartTotals = (items) => {
  let totalItems = 0;
  let totalAmount = 0;

  for (const item of items) {
    const quantity = Number(item.quantity);
    const price =
      Number(item.discountPrice) > 0 && Number(item.discountPrice) < Number(item.price)
        ? Number(item.discountPrice)
        : Number(item.price);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Invalid cart quantity.");
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Invalid cart item price.");
    }

    totalItems += quantity;
    totalAmount += price * quantity;
  }

  return {
    totalItems,
    totalAmount: Number(totalAmount.toFixed(2)),
  };
};

// ============================================================
// ADD TO CART
// ============================================================

exports.addToCart = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    const { productId, variantId, quantity } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Valid productId is required.",
      });
    }

    if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({
        success: false,
        message: "Valid variantId is required.",
      });
    }

    const requestedQuantity = Number(quantity);

    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer.",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable.",
      });
    }

    if (product.availability === "Out of Stock") {
      return res.status(400).json({
        success: false,
        message: "This product is currently out of stock.",
      });
    }

    const variant = getVariant(product, variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Selected product variant not found.",
      });
    }

    if (variant.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Selected product variant is unavailable.",
      });
    }

    const price = Number(variant.price);
    const discountPrice = Number(variant.discountPrice) || 0;

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Selected variant does not have a valid price.",
      });
    }

    let cart = await Cart.findOne({
      userId,
      status: "active",
    });

    if (!cart) {
      const effectivePrice =
        discountPrice > 0 && discountPrice < price ? discountPrice : price;

      cart = new Cart({
        userId,
        items: [
          {
            product: productId,
            variantId,
            quantity: requestedQuantity,
            price,
            discountPrice,
          },
        ],
        totalItems: requestedQuantity,
        totalAmount: Number((effectivePrice * requestedQuantity).toFixed(2)),
        status: "active",
      });

      await cart.save();

      await cart.populate({
        path: "items.product",
        select: "name availability variants categoryId brandId",
      });

      return res.status(201).json({
        success: true,
        message: "Product added to cart successfully.",
        cart,
      });
    }

    const existingItem = cart.items.find(
      (item) =>
        item.product.toString() === productId.toString() &&
        item.variantId.toString() === variantId.toString()
    );

    if (existingItem) {
      existingItem.quantity += requestedQuantity;
      existingItem.price = price;
      existingItem.discountPrice = discountPrice;
    } else {
      cart.items.push({
        product: productId,
        variantId,
        quantity: requestedQuantity,
        price,
        discountPrice,
      });
    }

    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.totalAmount = totals.totalAmount;

    await cart.save();

    await cart.populate({
      path: "items.product",
      select: "name availability variants categoryId brandId",
    });

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully.",
      cart,
    });
  } catch (error) {
    console.error("ADD TO CART ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add product to cart.",
    });
  }
};

// ============================================================
// GET CART
// ============================================================

exports.getCart = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    const cart = await Cart.findOne({
      userId,
      status: "active",
    }).populate({
      path: "items.product",
      select: "name availability variants categoryId brandId",
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty.",
        cart: {
          userId,
          items: [],
          totalItems: 0,
          totalAmount: 0,
          status: "active",
        },
      });
    }

    let totalItems = 0;
    let totalAmount = 0;

    for (const item of cart.items) {
      if (!item.product) {
        return res.status(400).json({
          success: false,
          message: "A product in your cart no longer exists.",
        });
      }

      const variant = item.product.variants.find(
        (v) => v._id.toString() === item.variantId.toString()
      );

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Variant not found for ${item.product.name}.`,
        });
      }

      const price = Number(variant.price);
      const discountPrice = Number(variant.discountPrice) || 0;

      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for ${item.product.name}.`,
        });
      }

      const effectivePrice =
        discountPrice > 0 && discountPrice < price ? discountPrice : price;

      item.price = price;
      item.discountPrice = discountPrice;

      const quantity = Number(item.quantity);
      totalItems += quantity;
      totalAmount += effectivePrice * quantity;
    }

    cart.totalItems = totalItems;
    cart.totalAmount = Number(totalAmount.toFixed(2));

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully.",
      cart,
    });
  } catch (error) {
    console.error("GET CART ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch cart.",
    });
  }
};

// ============================================================
// UPDATE CART QUANTITY
// ============================================================

exports.updateCartQuantity = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, variantId, quantity } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId or variantId.",
      });
    }

    const newQuantity = Number(quantity);

    if (!Number.isInteger(newQuantity) || newQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer.",
      });
    }

    const cart = await Cart.findOne({
      userId,
      status: "active",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found.",
      });
    }

    const item = cart.items.find(
      (cartItem) =>
        cartItem.product.toString() === productId.toString() &&
        cartItem.variantId.toString() === variantId.toString()
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found.",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const variant = getVariant(product, variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found.",
      });
    }

    item.quantity = newQuantity;
    item.price = Number(variant.price);
    item.discountPrice = Number(variant.discountPrice) || 0;

    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.totalAmount = totals.totalAmount;

    await cart.save();

    await cart.populate({
      path: "items.product",
      select: "name availability variants categoryId brandId",
    });

    return res.status(200).json({
      success: true,
      message: "Cart quantity updated successfully.",
      cart,
    });
  } catch (error) {
    console.error("UPDATE CART ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update cart.",
    });
  }
};

// ============================================================
// REMOVE CART ITEM
// ============================================================

exports.removeFromCart = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, variantId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    const cart = await Cart.findOne({
      userId,
      status: "active",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found.",
      });
    }

    const oldLength = cart.items.length;

    cart.items = cart.items.filter(
      (item) =>
        !(
          item.product.toString() === productId.toString() &&
          item.variantId.toString() === variantId.toString()
        )
    );

    if (cart.items.length === oldLength) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found.",
      });
    }

    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.totalAmount = totals.totalAmount;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart item removed successfully.",
      cart,
    });
  } catch (error) {
    console.error("REMOVE CART ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove cart item.",
    });
  }
};

// ============================================================
// CLEAR CART
// ============================================================

exports.clearCart = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login.",
      });
    }

    const cart = await Cart.findOne({
      userId,
      status: "active",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found.",
      });
    }

    cart.items = [];
    cart.totalItems = 0;
    cart.totalAmount = 0;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully.",
      cart,
    });
  } catch (error) {
    console.error("CLEAR CART ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to clear cart.",
    });
  }
};