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

// const calculateProductStock = (product) => {
//   let totalStock = 0;

//   product.variants.forEach((variant) => {
//     variant.sizes.forEach((size) => {
//       totalStock += Number(size.stockQuantity || 0);
//     });
//   });

//   return totalStock;
// };

const calculateProductStock = (product) => {
  let totalStock = 0;

  (product.variants || []).forEach((variant) => {
    (variant.sizes || []).forEach((size) => {
      if (size.isActive !== false) {
        totalStock += Number(size.stockQuantity || 0);
      }
    });
  });

  return totalStock;
};

// ============================================================
// RECALCULATE INVENTORY TOTALS
// ============================================================

const calculateInventoryTotals = (inventory) => {
  let totalStock = 0;

  (inventory.variants || []).forEach((variant) => {
    if (Array.isArray(variant.sizes)) {
      variant.sizes.forEach((size) => {
        totalStock += Number(size.stockQuantity || 0);
      });
    }
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

  // Do not recreate disabled inventory
  if (inventory && inventory.isEnabled === false) {
    return inventory;
  }

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

  // inventory.variants = (product.variants || []).map(
  //   (productVariant) => ({
  //     variantId: productVariant._id,

  //     color: productVariant.color || "",

  //     sizes: (Array.isArray(productVariant.sizes) ? productVariant.sizes : []).map(
  //       (productSize) => ({
  //         sizeId: productSize._id,

  //         size: productSize.size || "",

  //         sku: productSize.sku || "",

  //         barcode: productSize.barcode || "",

  //         stockQuantity: Number(
  //           productSize.stockQuantity || 0
  //         ),
  //       })
  //     ),
  //   })
  // );

  inventory.variants = (product.variants || []).map(
  (productVariant) => ({
    variantId: productVariant._id,
    color: productVariant.color || "",

    sizes: (
      Array.isArray(productVariant.sizes)
        ? productVariant.sizes
        : []
    )
      .filter((productSize) => productSize.isActive !== false)
      .map((productSize) => ({
        sizeId: productSize._id,
        size: productSize.size || "",
        sku: productSize.sku || "",
        barcode: productSize.barcode || "",
        stockQuantity: Number(
          productSize.stockQuantity || 0
        ),
      })),
  })
);

  calculateInventoryTotals(inventory);

  await inventory.save(
    session ? { session } : {}
  );

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
  session = null,
}) => {
  const updatedItems = [];

  for (const orderItem of orderItems) {
    const productId = orderItem.product;
    const variantId = orderItem.variantId;
    const sizeId = orderItem.sizeId;
    const quantity = Number(orderItem.quantity);

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error(`Invalid product ID for order item ${orderItem._id || ""}`);
    }

    if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error(`Invalid variant ID for order item ${orderItem._id || ""}`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity for order item ${orderItem._id || ""}`);
    }

    // 1. Fetch Product
    const productQuery = Product.findById(productId);
    if (session) productQuery.session(session);
    const product = await productQuery;

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // 2. Find Variant
    const variant = (product.variants || []).find(
      (v) => String(v._id) === String(variantId)
    );

    if (!variant) {
      throw new Error(`Product variant not found: ${variantId}`);
    }

    // 3. Find Size (by sizeId or by size name fallback)
    let targetSize = null;
    if (Array.isArray(variant.sizes) && variant.sizes.length > 0) {
      if (sizeId && mongoose.Types.ObjectId.isValid(sizeId)) {
        targetSize = variant.sizes.find(
          (s) => String(s._id) === String(sizeId)
        );
      }
      if (!targetSize && orderItem.size) {
        targetSize = variant.sizes.find(
          (s) => String(s.size).trim().toUpperCase() === String(orderItem.size).trim().toUpperCase()
        );
      }
      if (!targetSize) {
        targetSize = variant.sizes[0];
      }
    }

    // 4. Validate & Decrease Stock
    if (targetSize) {
      const currentStock = Number(targetSize.stockQuantity || 0);
      if (currentStock < quantity) {
        throw new Error(
          `Insufficient stock for "${orderItem.productName || product.name}" (Size: ${targetSize.size}). Available: ${currentStock}, Requested: ${quantity}`
        );
      }
      targetSize.stockQuantity = currentStock - quantity;
      variant.quantity = variant.sizes.reduce(
        (sum, s) => sum + (Number(s.stockQuantity) || 0),
        0
      );
    } else {
      const currentStock = Number(variant.quantity || 0);
      if (currentStock < quantity) {
        throw new Error(
          `Insufficient stock for "${orderItem.productName || product.name}". Available: ${currentStock}, Requested: ${quantity}`
        );
      }
      variant.quantity = currentStock - quantity;
    }

    // 5. Recalculate total product stock & availability
    const totalProductStock = (product.variants || []).reduce(
      (sum, v) => sum + (Number(v.quantity) || 0),
      0
    );
    product.availability = totalProductStock > 0 ? "In Stock" : "Out of Stock";

    await product.save(session ? { session } : {});

    // 6. Synchronize Inventory collection
    const inventory = await syncProductInventory(product._id, { session });

    updatedItems.push({
      orderItemId: orderItem._id,
      productId,
      variantId,
      sizeId: targetSize ? targetSize._id : variantId,
      quantity,
      remainingProductStock: totalProductStock,
      remainingSizeStock: targetSize ? targetSize.stockQuantity : variant.quantity,
      inventoryStatus: inventory ? inventory.stockStatus : undefined,
    });
  }

  return updatedItems;
};

// ============================================================
// RESTORE STOCK ON ORDER CANCELLATION
// ============================================================

const restoreStockForOrder = async ({ orderItems, session = null }) => {
  const restoredItems = [];

  for (const orderItem of orderItems) {
    const productId = orderItem.product;
    const variantId = orderItem.variantId;
    const sizeId = orderItem.sizeId;
    const quantity = Number(orderItem.quantity);

    if (!productId || !quantity || quantity <= 0) continue;

    const productQuery = Product.findById(productId);
    if (session) productQuery.session(session);
    const product = await productQuery;
    if (!product) continue;

    const variant = (product.variants || []).find(
      (v) => String(v._id) === String(variantId)
    );
    if (!variant) continue;

    let targetSize = null;
    if (Array.isArray(variant.sizes) && variant.sizes.length > 0) {
      if (sizeId && mongoose.Types.ObjectId.isValid(sizeId)) {
        targetSize = variant.sizes.find(
          (s) => String(s._id) === String(sizeId)
        );
      }
      if (!targetSize && orderItem.size) {
        targetSize = variant.sizes.find(
          (s) => String(s.size).trim().toUpperCase() === String(orderItem.size).trim().toUpperCase()
        );
      }
      if (!targetSize) {
        targetSize = variant.sizes[0];
      }
    }

    if (targetSize) {
      targetSize.stockQuantity = Number(targetSize.stockQuantity || 0) + quantity;
      variant.quantity = variant.sizes.reduce(
        (sum, s) => sum + (Number(s.stockQuantity) || 0),
        0
      );
    } else {
      variant.quantity = Number(variant.quantity || 0) + quantity;
    }

    const totalProductStock = (product.variants || []).reduce(
      (sum, v) => sum + (Number(v.quantity) || 0),
      0
    );
    product.availability = totalProductStock > 0 ? "In Stock" : "Out of Stock";

    await product.save(session ? { session } : {});
    await syncProductInventory(product._id, { session });

    restoredItems.push({
      orderItemId: orderItem._id,
      productId,
      restoredQuantity: quantity,
    });
  }

  return restoredItems;
};

module.exports = {
  syncProductInventory,
  syncAllProductInventory,
  updateProductSizeStock,
  decreaseStockAfterPayment,
  restoreStockForOrder,
};