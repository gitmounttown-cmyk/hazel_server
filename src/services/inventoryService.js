const Inventory = require("../models/inventoryModel");
const Product = require("../models/productModel");
const Notification = require("../models/notificationModel");

// ============================================================
// GLOBAL INVENTORY SETTINGS
// ============================================================

const LOW_STOCK_THRESHOLD = 10;

// ============================================================
// CALCULATE TOTAL PRODUCT STOCK
// ============================================================

const calculateProductStock = (product) => {
  let totalQuantity = 0;

  if (!product || !Array.isArray(product.variants)) {
    return 0;
  }

  product.variants.forEach((variant) => {
    if (Array.isArray(variant.sizes)) {
      variant.sizes.forEach((size) => {
        totalQuantity += Number(size.stockQuantity) || 0;
      });
    } else {
      totalQuantity += Number(variant.quantity) || 0;
    }
  });

  return totalQuantity;
};

// ============================================================
// GET STOCK STATUS
// ============================================================

const getStockStatus = (
  availableQuantity,
  threshold = LOW_STOCK_THRESHOLD
) => {
  if (availableQuantity <= 0) {
    return "OUT_OF_STOCK";
  }

  if (availableQuantity <= threshold) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
};

// ============================================================
// BUILD INVENTORY VARIANTS
// ============================================================

const buildInventoryVariants = (product) => {
  if (!product || !Array.isArray(product.variants)) {
    return [];
  }

  return product.variants.map((variant) => ({
    variantId: variant._id,

    color: variant.color || "",

    sizes: Array.isArray(variant.sizes)
      ? variant.sizes.map((size) => ({
          sizeId: size._id,
          size: size.size || "",
          sku: size.sku || "",
          barcode: size.barcode || "",
          stockQuantity:
            Number(size.stockQuantity) || 0,
        }))
      : [],
  }));
};

// ============================================================
// CREATE LOW STOCK NOTIFICATION
// ============================================================

const createLowStockNotification = async ({
  product,
  inventory,
}) => {
  if (!Notification) {
    return null;
  }

  const existingNotification =
    await Notification.findOne({
      productId: product._id,
      type: "LOW_STOCK",
      isResolved: false,
    });

  if (existingNotification) {
    return existingNotification;
  }

  return Notification.create({
    type: "LOW_STOCK",
    title: "Low Stock Alert",
    message:
      `${product.name} has only ` +
      `${inventory.availableStock} items remaining.`,

    productId: product._id,
    inventoryId: inventory._id,

    recipientRole: "all",

    isRead: false,
    isResolved: false,
  });
};

// ============================================================
// CREATE OUT OF STOCK NOTIFICATION
// ============================================================

const createOutOfStockNotification = async ({
  product,
  inventory,
}) => {
  if (!Notification) {
    return null;
  }

  const existingNotification =
    await Notification.findOne({
      productId: product._id,
      type: "OUT_OF_STOCK",
      isResolved: false,
    });

  if (existingNotification) {
    return existingNotification;
  }

  return Notification.create({
    type: "OUT_OF_STOCK",
    title: "Out of Stock",
    message:
      `${product.name} is currently out of stock.`,

    productId: product._id,
    inventoryId: inventory._id,

    recipientRole: "all",

    isRead: false,
    isResolved: false,
  });
};

// ============================================================
// RESOLVE STOCK NOTIFICATIONS
// ============================================================

const resolveStockNotifications = async (
  productId
) => {
  if (!Notification) {
    return;
  }

  await Notification.updateMany(
    {
      productId,

      type: {
        $in: [
          "LOW_STOCK",
          "OUT_OF_STOCK",
        ],
      },

      isResolved: false,
    },

    {
      $set: {
        isResolved: true,
      },
    }
  );
};

// ============================================================
// HANDLE STOCK NOTIFICATION
// ============================================================

const handleStockNotification = async ({
  product,
  inventory,
  previousStatus,
}) => {
  const currentStatus =
    inventory.stockStatus;

  if (
    currentStatus === "LOW_STOCK" &&
    previousStatus !== "LOW_STOCK"
  ) {
    await createLowStockNotification({
      product,
      inventory,
    });
  }

  if (
    currentStatus === "OUT_OF_STOCK" &&
    previousStatus !== "OUT_OF_STOCK"
  ) {
    await createOutOfStockNotification({
      product,
      inventory,
    });
  }

  if (currentStatus === "IN_STOCK") {
    await resolveStockNotifications(
      product._id
    );
  }
};

// ============================================================
// SYNC ONE PRODUCT → INVENTORY
// ============================================================

const syncProductInventory = async (
  productOrId,
  options = {}
) => {
  let product;

  // ----------------------------------------------------------
  // ACCEPT PRODUCT DOCUMENT OR PRODUCT ID
  // ----------------------------------------------------------

  if (
    productOrId &&
    typeof productOrId === "object" &&
    productOrId.variants
  ) {
    product = productOrId;
  } else {
    product =
      await Product.findById(productOrId);
  }

  if (!product) {
    throw new Error("Product not found");
  }

  // ----------------------------------------------------------
  // CALCULATE TOTAL STOCK
  // ----------------------------------------------------------

  const totalQuantity =
    calculateProductStock(product);

  // ----------------------------------------------------------
  // BUILD VARIANTS
  // ----------------------------------------------------------

  const inventoryVariants =
    buildInventoryVariants(product);

  // ----------------------------------------------------------
  // FIND EXISTING INVENTORY
  // ----------------------------------------------------------

  let inventory =
    await Inventory.findOne({
      productId: product._id,
    });

  const previousStatus =
    inventory?.stockStatus || null;

  // ----------------------------------------------------------
  // RESERVED STOCK
  // ----------------------------------------------------------

  const reservedStock =
    Number(inventory?.reservedStock) || 0;

  // ----------------------------------------------------------
  // AVAILABLE STOCK
  // ----------------------------------------------------------

  const availableStock =
    Math.max(
      totalQuantity - reservedStock,
      0
    );

  // ----------------------------------------------------------
  // STOCK STATUS
  // ----------------------------------------------------------

  const stockStatus =
    getStockStatus(
      availableStock,
      LOW_STOCK_THRESHOLD
    );

  // ----------------------------------------------------------
  // INVENTORY DATA
  // ----------------------------------------------------------

  const inventoryData = {
    productId: product._id,

    totalStock: totalQuantity,

    availableStock,

    reservedStock,

    stockStatus,

    lowStockThreshold:
      LOW_STOCK_THRESHOLD,

    variants: inventoryVariants,

    lastSyncedAt: new Date(),
  };

  // ----------------------------------------------------------
  // CREATE INVENTORY
  // ----------------------------------------------------------

  if (!inventory) {
    inventory =
      await Inventory.create(
        inventoryData
      );
  }

  // ----------------------------------------------------------
  // UPDATE INVENTORY
  // ----------------------------------------------------------

  else {
    inventory.totalStock =
      totalQuantity;

    inventory.availableStock =
      availableStock;

    inventory.reservedStock =
      reservedStock;

    inventory.stockStatus =
      stockStatus;

    inventory.lowStockThreshold =
      LOW_STOCK_THRESHOLD;

    inventory.variants =
      inventoryVariants;

    inventory.lastSyncedAt =
      new Date();

    await inventory.save();
  }

  // ----------------------------------------------------------
  // NOTIFICATIONS
  // ----------------------------------------------------------

  if (options.notify !== false) {
    await handleStockNotification({
      product,
      inventory,
      previousStatus,
    });
  }

  return inventory;
};

// ============================================================
// UPDATE SPECIFIC SIZE STOCK
// ============================================================

const updateProductSizeStock = async ({
  product,
  variantId,
  sizeId,
  stockQuantity,
}) => {
  if (!product) {
    throw new Error(
      "Product is required"
    );
  }

  // ----------------------------------------------------------
  // FIND VARIANT
  // ----------------------------------------------------------

  const variant =
    product.variants.id(variantId);

  if (!variant) {
    throw new Error(
      "Product variant not found"
    );
  }

  // ----------------------------------------------------------
  // FIND SIZE
  // ----------------------------------------------------------

  const size =
    variant.sizes.id(sizeId);

  if (!size) {
    throw new Error(
      "Product size not found"
    );
  }

  // ----------------------------------------------------------
  // VALIDATE QUANTITY
  // ----------------------------------------------------------

  const quantity =
    Number(stockQuantity);

  if (
    !Number.isFinite(quantity) ||
    quantity < 0
  ) {
    throw new Error(
      "Stock quantity must be a valid number greater than or equal to 0"
    );
  }

  // ----------------------------------------------------------
  // UPDATE PRODUCT STOCK
  // ----------------------------------------------------------

  size.stockQuantity =
    Math.floor(quantity);

  // Product pre-save middleware
  // recalculates:
  // variant.quantity
  // product.availability

  await product.save();

  // ----------------------------------------------------------
  // SYNC PRODUCT → INVENTORY
  // ----------------------------------------------------------

  const inventory =
    await syncProductInventory(
      product,
      {
        notify: true,
      }
    );

  return {
    product,
    inventory,
  };
};

// ============================================================
// SYNC ALL PRODUCTS
// ============================================================

const syncAllProductInventory =
  async () => {
    const products =
      await Product.find({
        isDeleted: {
          $ne: true,
        },
      });

    console.log(
      `Found ${products.length} products for inventory synchronization`
    );

    let created = 0;
    let updated = 0;
    let failed = 0;

    const errors = [];

    for (const product of products) {
      try {
        const existing =
          await Inventory.findOne({
            productId: product._id,
          });

        await syncProductInventory(
          product,
          {
            notify: false,
          }
        );

        if (existing) {
          updated++;
        } else {
          created++;
        }
      } catch (error) {
        failed++;

        errors.push({
          productId:
            product._id,

          productName:
            product.name,

          message:
            error.message,
        });

        console.error(
          `Inventory sync failed for ${product.name}:`,
          error.message
        );
      }
    }

    return {
      totalProducts:
        products.length,

      created,

      updated,

      failed,

      errors,
    };
  };

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  LOW_STOCK_THRESHOLD,
  calculateProductStock,
  getStockStatus,
  buildInventoryVariants,
  syncProductInventory,
  updateProductSizeStock,
  syncAllProductInventory,
};