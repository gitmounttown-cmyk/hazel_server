const mongoose = require("mongoose");

const Inventory = require("../models/inventoryModel");
const Product = require("../models/productModel");

// ============================================================
// UPDATE INVENTORY STATUS
// ============================================================

const calculateStockStatus = (
  availableStock,
  lowStockThreshold
) => {
  if (availableStock <= 0) {
    return "OUT_OF_STOCK";
  }

  if (availableStock <= lowStockThreshold) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
};

// ============================================================
// RECALCULATE PRODUCT QUANTITY
// ============================================================

const calculateProductStock = (product) => {
  let totalStock = 0;

  product.variants.forEach((variant) => {
    variant.sizes.forEach((size) => {
      totalStock += Number(size.stockQuantity || 0);
    });
  });

  return totalStock;
};

// ============================================================
// RECALCULATE INVENTORY TOTALS
// ============================================================

const calculateInventoryTotals = (inventory) => {
  let totalStock = 0;

  inventory.variants.forEach((variant) => {
    variant.sizes.forEach((size) => {
      totalStock += Number(size.stockQuantity || 0);
    });
  });

  const reservedStock = Number(
    inventory.reservedStock || 0
  );

  const availableStock = Math.max(
    0,
    totalStock - reservedStock
  );

  inventory.totalStock = totalStock;

  inventory.availableStock = availableStock;

  inventory.stockStatus = calculateStockStatus(
    availableStock,
    Number(inventory.lowStockThreshold || 10)
  );

  inventory.lastSyncedAt = new Date();
};

// ============================================================
// SYNC PRODUCT -> INVENTORY
// ============================================================

const syncProductInventory = async (
  productId,
  options = {}
) => {
  const { session = null } = options;

  const productQuery = Product.findById(productId);

  if (session) {
    productQuery.session(session);
  }

  const product = await productQuery;

  if (!product) {
    throw new Error("Product not found");
  }

  let inventoryQuery = Inventory.findOne({
    productId: product._id,
  });

  if (session) {
    inventoryQuery.session(session);
  }

  let inventory = await inventoryQuery;

  // ----------------------------------------------------------
  // CREATE INVENTORY IF NOT EXISTS
  // ----------------------------------------------------------

  if (!inventory) {
    inventory = new Inventory({
      productId: product._id,
      totalStock: 0,
      availableStock: 0,
      reservedStock: 0,
      lowStockThreshold: 10,
      stockStatus: "OUT_OF_STOCK",
      variants: [],
    });
  }

  // ----------------------------------------------------------
  // BUILD INVENTORY VARIANTS
  // ----------------------------------------------------------

  inventory.variants = product.variants.map(
    (productVariant) => ({
      variantId: productVariant._id,

      color: productVariant.color || "",

      sizes: productVariant.sizes.map(
        (productSize) => ({
          sizeId: productSize._id,

          size: productSize.size || "",

          sku: productSize.sku || "",

          barcode: productSize.barcode || "",

          stockQuantity: Number(
            productSize.stockQuantity || 0
          ),
        })
      ),
    })
  );

  calculateInventoryTotals(inventory);

  await inventory.save({
    session,
  });

  return inventory;
};

// ============================================================
// SYNC ALL PRODUCTS
// ============================================================

const syncAllProductInventory = async () => {
  const products = await Product.find({
    isDeleted: {
      $ne: true,
    },
  });

  let syncedCount = 0;

  for (const product of products) {
    await syncProductInventory(product._id);
    syncedCount++;
  }

  return {
    syncedCount,
  };
};

// ============================================================
// UPDATE PRODUCT SIZE STOCK
// ============================================================

const updateProductSizeStock = async ({
  product,
  variantId,
  sizeId,
  stockQuantity,
}) => {
  const quantity = Number(stockQuantity);

  if (
    !Number.isFinite(quantity) ||
    quantity < 0
  ) {
    throw new Error(
      "stockQuantity must be a valid number >= 0"
    );
  }

  const variant = product.variants.find(
    (item) =>
      String(item._id) === String(variantId)
  );

  if (!variant) {
    throw new Error("Product variant not found");
  }

  const size = variant.sizes.find(
    (item) =>
      String(item._id) === String(sizeId)
  );

  if (!size) {
    throw new Error("Product size not found");
  }

  // ----------------------------------------------------------
  // UPDATE PRODUCT STOCK
  // ----------------------------------------------------------

  size.stockQuantity = quantity;

  const totalProductStock =
    calculateProductStock(product);

  product.availability =
    totalProductStock > 0
      ? "In Stock"
      : "Out of Stock";

  await product.save();

  // ----------------------------------------------------------
  // SYNC INVENTORY
  // ----------------------------------------------------------

  const inventory =
    await syncProductInventory(
      product._id
    );

  return {
    product,
    inventory,
  };
};

// ============================================================
// DECREASE STOCK AFTER SUCCESSFUL PAYMENT
// ============================================================

const decreaseStockAfterPayment = async ({
  orderItems,
  session,
}) => {
  if (!session) {
    throw new Error(
      "MongoDB transaction session is required"
    );
  }

  const updatedItems = [];

  for (const orderItem of orderItems) {
    const productId =
      orderItem.product;

    const variantId =
      orderItem.variantId;

    const sizeId =
      orderItem.sizeId;

    const quantity =
      Number(orderItem.quantity);

    if (
      !mongoose.Types.ObjectId.isValid(
        productId
      )
    ) {
      throw new Error(
        `Invalid product ID for order item ${orderItem._id}`
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        variantId
      )
    ) {
      throw new Error(
        `Invalid variant ID for order item ${orderItem._id}`
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        sizeId
      )
    ) {
      throw new Error(
        `Invalid size ID for order item ${orderItem._id}`
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `Invalid quantity for order item ${orderItem._id}`
      );
    }

    // ========================================================
    // 1. DECREASE PRODUCT STOCK
    // ========================================================

    const updatedProduct =
      await Product.findOneAndUpdate(
        {
          _id: productId,

          "variants._id": variantId,

          "variants.sizes._id": sizeId,

          "variants.sizes.stockQuantity": {
            $gte: quantity,
          },
        },
        {
          $inc: {
            "variants.$[variant].sizes.$[size].stockQuantity":
              -quantity,
          },
        },
        {
          new: true,

          session,

          arrayFilters: [
            {
              "variant._id": variantId,
            },
            {
              "size._id": sizeId,
            },
          ],
        }
      );

    // ========================================================
    // STOCK NOT AVAILABLE
    // ========================================================

    if (!updatedProduct) {
      throw new Error(
        `Insufficient stock for product ${productId}, variant ${variantId}, size ${sizeId}`
      );
    }

    // ========================================================
    // 2. RECALCULATE PRODUCT AVAILABILITY
    // ========================================================

    const totalProductStock =
      calculateProductStock(
        updatedProduct
      );

    updatedProduct.availability =
      totalProductStock > 0
        ? "In Stock"
        : "Out of Stock";

    await updatedProduct.save({
      session,
    });

    // ========================================================
    // 3. UPDATE INVENTORY
    // ========================================================

    const inventory =
      await Inventory.findOne({
        productId,
      }).session(session);

    if (!inventory) {
      throw new Error(
        `Inventory not found for product ${productId}`
      );
    }

    // ========================================================
    // FIND INVENTORY VARIANT
    // ========================================================

    const inventoryVariant =
      inventory.variants.find(
        (variant) =>
          String(variant.variantId) ===
          String(variantId)
      );

    if (!inventoryVariant) {
      throw new Error(
        `Inventory variant not found: ${variantId}`
      );
    }

    // ========================================================
    // FIND INVENTORY SIZE
    // ========================================================

    const inventorySize =
      inventoryVariant.sizes.find(
        (size) =>
          String(size.sizeId) ===
          String(sizeId)
      );

    if (!inventorySize) {
      throw new Error(
        `Inventory size not found: ${sizeId}`
      );
    }

    // ========================================================
    // DOUBLE-CHECK INVENTORY STOCK
    // ========================================================

    if (
      Number(inventorySize.stockQuantity) <
      quantity
    ) {
      throw new Error(
        `Inventory stock is insufficient for ${orderItem.productName}`
      );
    }

    // ========================================================
    // DECREASE INVENTORY STOCK
    // ========================================================

    inventorySize.stockQuantity =
      Number(
        inventorySize.stockQuantity
      ) - quantity;

    // ========================================================
    // RECALCULATE INVENTORY TOTALS
    // ========================================================

    calculateInventoryTotals(
      inventory
    );

    await inventory.save({
      session,
    });

    updatedItems.push({
      orderItemId: orderItem._id,

      productId,

      variantId,

      sizeId,

      quantity,

      remainingProductStock:
        totalProductStock,

      remainingInventoryStock:
        inventorySize.stockQuantity,
    });
  }

  return updatedItems;
};

module.exports = {
  syncProductInventory,

  syncAllProductInventory,

  updateProductSizeStock,

  decreaseStockAfterPayment,
};