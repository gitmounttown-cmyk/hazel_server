const mongoose = require("mongoose");

const Cart = require("../models/cartModel");
const Product = require("../models/productModel");

// ============================================================
// GET USER ID FROM JWT
// ============================================================

const getUserId = (req) => {
  return req.user?._id || req.user?.id;
};

// ============================================================
// GET VARIANT FROM PRODUCT
// ============================================================

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

// ============================================================
// GET SIZE FROM VARIANT
// ============================================================

const getSize = (variant, size) => {
  if (!variant || !Array.isArray(variant.sizes)) {
    return null;
  }

  return variant.sizes.find(
    (item) =>
      item.size &&
      item.size.toUpperCase() === size.toUpperCase()
  );
};

// ============================================================
// GET EFFECTIVE PRICE
// ============================================================

const getVariantPrice = (variant) => {
  if (!variant) {
    return null;
  }

  const price = Number(variant.price);
  const discountPrice = Number(variant.discountPrice);

  // Discount price
  if (
    Number.isFinite(discountPrice) &&
    discountPrice > 0 &&
    Number.isFinite(price) &&
    discountPrice < price
  ) {
    return discountPrice;
  }

  // Normal price
  if (
    Number.isFinite(price) &&
    price > 0
  ) {
    return price;
  }

  return null;
};

// ============================================================
// CALCULATE CART TOTALS
// ============================================================

const calculateCartTotals = (items) => {
  let totalItems = 0;
  let totalAmount = 0;

  for (const item of items) {
    const quantity = Number(item.quantity);
    const price = Number(item.price);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Invalid cart quantity."
      );
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        "Invalid cart item price."
      );
    }

    totalItems += quantity;

    totalAmount += price * quantity;
  }

  return {
    totalItems,
    totalAmount: Number(
      totalAmount.toFixed(2)
    ),
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

    const {
      productId,
      variantId,
      color,
      size,
      quantity,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATE PRODUCT ID
    // --------------------------------------------------------

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId.",
      });
    }

    // --------------------------------------------------------
    // VALIDATE VARIANT ID
    // --------------------------------------------------------

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: "variantId is required.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(variantId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variantId.",
      });
    }

    // --------------------------------------------------------
    // VALIDATE COLOR
    // --------------------------------------------------------

    if (!color) {
      return res.status(400).json({
        success: false,
        message: "color is required.",
      });
    }

    // --------------------------------------------------------
    // VALIDATE SIZE
    // --------------------------------------------------------

    if (!size) {
      return res.status(400).json({
        success: false,
        message: "size is required.",
      });
    }

    // --------------------------------------------------------
    // VALIDATE QUANTITY
    // --------------------------------------------------------

    const requestedQuantity = Number(quantity);

    if (
      !Number.isInteger(requestedQuantity) ||
      requestedQuantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be a positive integer.",
      });
    }

    // --------------------------------------------------------
    // FIND PRODUCT
    // --------------------------------------------------------

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found or unavailable.",
      });
    }

    // --------------------------------------------------------
    // PRODUCT AVAILABILITY
    // --------------------------------------------------------

    if (
      product.availability === "Out of Stock"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This product is currently out of stock.",
      });
    }

    // --------------------------------------------------------
    // FIND VARIANT
    // --------------------------------------------------------

    const variant = getVariant(
      product,
      variantId
    );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Selected product variant not found.",
      });
    }

    // --------------------------------------------------------
    // CHECK VARIANT ACTIVE
    // --------------------------------------------------------

    if (variant.isActive === false) {
      return res.status(400).json({
        success: false,
        message:
          "Selected product variant is unavailable.",
      });
    }

    // --------------------------------------------------------
    // CHECK COLOR
    // --------------------------------------------------------

    if (
      variant.color.toUpperCase() !==
      color.toUpperCase()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Selected color does not match the variant.",
      });
    }

    // --------------------------------------------------------
    // FIND SIZE
    // --------------------------------------------------------

    const selectedSize = getSize(
      variant,
      size
    );

    if (!selectedSize) {
      return res.status(404).json({
        success: false,
        message:
          "Selected size is not available.",
      });
    }

    // --------------------------------------------------------
    // CHECK SIZE ACTIVE
    // --------------------------------------------------------

    if (selectedSize.isActive === false) {
      return res.status(400).json({
        success: false,
        message:
          "Selected size is unavailable.",
      });
    }

    // --------------------------------------------------------
    // CHECK STOCK
    // --------------------------------------------------------

    const availableStock = Number(
      selectedSize.stockQuantity
    );

    if (
      !Number.isInteger(availableStock) ||
      availableStock <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Size ${size} is currently out of stock.`,
      });
    }

    // --------------------------------------------------------
    // GET PRICE
    // --------------------------------------------------------

    const price = getVariantPrice(
      variant
    );

    if (price === null) {
      return res.status(400).json({
        success: false,
        message:
          `Variant "${variant.color}" does not have a valid price.`,
      });
    }

    // --------------------------------------------------------
    // FIND CART
    // --------------------------------------------------------

    let cart = await Cart.findOne({
      userId,
      status: "active",
    });

    // --------------------------------------------------------
    // CREATE NEW CART
    // --------------------------------------------------------

    if (!cart) {
      cart = new Cart({
        userId,

        items: [
          {
            product: productId,
            variantId: variantId,
            color: variant.color,
            size: size.toUpperCase(),
            quantity: requestedQuantity,
            price,
          },
        ],

        totalItems: requestedQuantity,

        totalAmount: Number(
          (price * requestedQuantity).toFixed(2)
        ),

        status: "active",
      });

      await cart.save();

      await cart.populate({
        path: "items.product",
        select:
          "name availability variants categoryId brandId",
      });

      return res.status(201).json({
        success: true,
        message:
          "Product added to cart successfully.",
        cart,
      });
    }

    // --------------------------------------------------------
    // CHECK EXISTING SAME PRODUCT + VARIANT + SIZE
    // --------------------------------------------------------

    const existingItem =
      cart.items.find(
        (item) =>
          item.product.toString() ===
            productId.toString() &&
          item.variantId.toString() ===
            variantId.toString() &&
          item.size.toUpperCase() ===
            size.toUpperCase()
      );

    // --------------------------------------------------------
    // EXISTING ITEM
    // --------------------------------------------------------

    if (existingItem) {
      const newQuantity =
        existingItem.quantity +
        requestedQuantity;

      if (newQuantity > availableStock) {
        return res.status(400).json({
          success: false,
          message:
            `Only ${availableStock} units available for size ${size}.`,
        });
      }

      existingItem.quantity =
        newQuantity;

      // Refresh price from DB
      existingItem.price = price;
    }

    // --------------------------------------------------------
    // NEW ITEM
    // --------------------------------------------------------

    else {
      if (
        requestedQuantity >
        availableStock
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Only ${availableStock} units available for size ${size}.`,
        });
      }

      cart.items.push({
        product: productId,
        variantId: variantId,
        color: variant.color,
        size: size.toUpperCase(),
        quantity: requestedQuantity,
        price,
      });
    }

    // --------------------------------------------------------
    // CALCULATE TOTAL
    // --------------------------------------------------------

    const totals =
      calculateCartTotals(
        cart.items
      );

    cart.totalItems =
      totals.totalItems;

    cart.totalAmount =
      totals.totalAmount;

    await cart.save();

    await cart.populate({
      path: "items.product",
      select:
        "name availability variants categoryId brandId",
    });

    return res.status(200).json({
      success: true,
      message:
        "Product added to cart successfully.",
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
        error.message ||
        "Failed to add product to cart.",
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
      // ------------------------------------------------------
      // PRODUCT CHECK
      // ------------------------------------------------------

      if (!item.product) {
        return res.status(400).json({
          success: false,
          message: "A product in your cart no longer exists.",
        });
      }

      // ------------------------------------------------------
      // FIND VARIANT
      // ------------------------------------------------------

      const variant = item.product.variants.find(
        (v) =>
          v._id.toString() === item.variantId.toString()
      );

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Variant not found for ${item.product.name}.`,
        });
      }

      // ------------------------------------------------------
      // FIND SIZE
      // ------------------------------------------------------

      const selectedSize = variant.sizes.find(
        (s) =>
          s.size.toUpperCase() ===
          item.size.toUpperCase()
      );

      if (!selectedSize) {
        return res.status(400).json({
          success: false,
          message:
            `Size ${item.size} is no longer available for ${item.product.name}.`,
        });
      }

      // ------------------------------------------------------
      // GET CURRENT PRICE
      // ------------------------------------------------------

      const variantPrice = Number(variant.price);
      const variantDiscountPrice = Number(
        variant.discountPrice
      );

      let effectivePrice = null;

      if (
        Number.isFinite(variantDiscountPrice) &&
        variantDiscountPrice > 0 &&
        variantDiscountPrice < variantPrice
      ) {
        effectivePrice = variantDiscountPrice;
      } else if (
        Number.isFinite(variantPrice) &&
        variantPrice > 0
      ) {
        effectivePrice = variantPrice;
      }

      // ------------------------------------------------------
      // PRICE VALIDATION
      // ------------------------------------------------------

      if (effectivePrice === null) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid price for ${item.product.name}, variant ${variant.color}.`,
        });
      }

      // ------------------------------------------------------
      // STOCK VALIDATION
      // ------------------------------------------------------

      const stockQuantity = Number(
        selectedSize.stockQuantity
      );

      if (
        !Number.isFinite(stockQuantity) ||
        stockQuantity < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid stock for ${item.product.name}, size ${item.size}.`,
        });
      }

      // ------------------------------------------------------
      // CART QUANTITY
      // ------------------------------------------------------

      const quantity = Number(item.quantity);

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid quantity for ${item.product.name}.`,
        });
      }

      // ------------------------------------------------------
      // STOCK CHECK
      // ------------------------------------------------------

      if (quantity > stockQuantity) {
        return res.status(400).json({
          success: false,
          message:
            `Only ${stockQuantity} units available for ${item.product.name} - ${item.size}.`,
        });
      }

      // ------------------------------------------------------
      // UPDATE CURRENT PRICE
      // ------------------------------------------------------

      item.price = effectivePrice;

      // ------------------------------------------------------
      // TOTAL
      // ------------------------------------------------------

      totalItems += quantity;

      totalAmount +=
        effectivePrice * quantity;
    }

    // --------------------------------------------------------
    // UPDATE CART TOTALS
    // --------------------------------------------------------

    cart.totalItems = totalItems;

    cart.totalAmount = Number(
      totalAmount.toFixed(2)
    );

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
      message:
        error.message ||
        "Failed to fetch cart.",
    });
  }
};

// ============================================================
// UPDATE CART QUANTITY
// ============================================================

exports.updateCartQuantity = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    const {
      productId,
      variantId,
      size,
      quantity,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized. Please login.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid productId.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        variantId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid variantId.",
      });
    }

    const newQuantity =
      Number(quantity);

    if (
      !Number.isInteger(
        newQuantity
      ) ||
      newQuantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be a positive integer.",
      });
    }

    const cart =
      await Cart.findOne({
        userId,
        status: "active",
      });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message:
          "Cart not found.",
      });
    }

    const item =
      cart.items.find(
        (cartItem) =>
          cartItem.product.toString() ===
            productId.toString() &&
          cartItem.variantId.toString() ===
            variantId.toString() &&
          cartItem.size.toUpperCase() ===
            size.toUpperCase()
      );

    if (!item) {
      return res.status(404).json({
        success: false,
        message:
          "Cart item not found.",
      });
    }

    const product =
      await Product.findById(
        productId
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found.",
      });
    }

    const variant =
      getVariant(
        product,
        variantId
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Variant not found.",
      });
    }

    const selectedSize =
      getSize(
        variant,
        size
      );

    if (!selectedSize) {
      return res.status(404).json({
        success: false,
        message:
          "Size not found.",
      });
    }

    const stock =
      Number(
        selectedSize.stockQuantity
      );

    if (
      newQuantity >
      stock
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Only ${stock} units available for size ${size}.`,
      });
    }

    const price =
      getVariantPrice(
        variant
      );

    if (price === null) {
      return res.status(400).json({
        success: false,
        message:
          "Product does not have a valid price.",
      });
    }

    item.quantity =
      newQuantity;

    item.price =
      price;

    const totals =
      calculateCartTotals(
        cart.items
      );

    cart.totalItems =
      totals.totalItems;

    cart.totalAmount =
      totals.totalAmount;

    await cart.save();

    await cart.populate({
      path: "items.product",
      select:
        "name availability variants categoryId brandId",
    });

    return res.status(200).json({
      success: true,
      message:
        "Cart quantity updated successfully.",
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
        error.message ||
        "Failed to update cart.",
    });
  }
};

// ============================================================
// REMOVE CART ITEM
// ============================================================

exports.removeFromCart = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    const {
      productId,
      variantId,
      size,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized. Please login.",
      });
    }

    const cart =
      await Cart.findOne({
        userId,
        status: "active",
      });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message:
          "Cart not found.",
      });
    }

    const oldLength =
      cart.items.length;

    cart.items =
      cart.items.filter(
        (item) =>
          !(
            item.product.toString() ===
              productId.toString() &&
            item.variantId.toString() ===
              variantId.toString() &&
            item.size.toUpperCase() ===
              size.toUpperCase()
          )
      );

    if (
      cart.items.length ===
      oldLength
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Cart item not found.",
      });
    }

    const totals =
      calculateCartTotals(
        cart.items
      );

    cart.totalItems =
      totals.totalItems;

    cart.totalAmount =
      totals.totalAmount;

    await cart.save();

    return res.status(200).json({
      success: true,
      message:
        "Cart item removed successfully.",
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
        error.message ||
        "Failed to remove cart item.",
    });
  }
};

// ============================================================
// CLEAR CART
// ============================================================

exports.clearCart = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized. Please login.",
      });
    }

    const cart =
      await Cart.findOne({
        userId,
        status: "active",
      });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message:
          "Cart not found.",
      });
    }

    cart.items = [];
    cart.totalItems = 0;
    cart.totalAmount = 0;

    await cart.save();

    return res.status(200).json({
      success: true,
      message:
        "Cart cleared successfully.",
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
        error.message ||
        "Failed to clear cart.",
    });
  }
};