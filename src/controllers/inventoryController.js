const Inventory = require("../models/inventoryModel");
const StockHistory = require("../models/stockHistoryModel");
const Product = require("../models/productModel");

// ======================================================
// HELPER
// ======================================================

const updateStockStatus = (inventory) => {
  inventory.availableQuantity = Math.max(
    0,
    inventory.quantity - inventory.reservedQuantity
  );

  if (inventory.availableQuantity <= 0) {
    inventory.stockStatus = "OUT_OF_STOCK";
  } else if (
    inventory.availableQuantity <=
    inventory.lowStockThreshold
  ) {
    inventory.stockStatus = "LOW_STOCK";
  } else {
    inventory.stockStatus = "IN_STOCK";
  }
};

// ======================================================
// CREATE INVENTORY
// POST /api/inventory/create
// ======================================================

exports.createInventory = async (req, res) => {
  try {
    const {
      productId,
      quantity = 0,
      lowStockThreshold = 5,
      reorderQuantity = 10,
      purchasePrice = 0,
      sellingPrice = 0,
    } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Check product
    const product = await Product.findOne({
      _id: productId,
      isDeleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check existing inventory
    const existing = await Inventory.findOne({
      productId,
      isDeleted: false,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          "Inventory already exists for this product",
      });
    }

    const inventory = new Inventory({
      productId,
      quantity,
      reservedQuantity: 0,
      lowStockThreshold,
      reorderQuantity,
      purchasePrice,
      sellingPrice,
    });

    updateStockStatus(inventory);

    await inventory.save();

    // Initial stock history
    if (Number(quantity) > 0) {
      await StockHistory.create({
        productId,
        inventoryId: inventory._id,
        type: "STOCK_IN",
        quantity: Number(quantity),
        previousQuantity: 0,
        newQuantity: Number(quantity),
        reason: "Initial stock",
        createdBy: req.user?.id || req.user?._id,
      });
    }

    const populatedInventory =
      await Inventory.findById(
        inventory._id
      ).populate(
        "productId",
        "name sku price images"
      );

    return res.status(201).json({
      success: true,
      message: "Inventory created successfully",
      data: populatedInventory,
    });
  } catch (error) {
    console.error(
      "CREATE INVENTORY ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create inventory",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL INVENTORY
// GET /api/inventory/all
// ======================================================

exports.getAllInventory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status,
    } = req.query;

    const currentPage =
      Math.max(Number(page), 1);

    const perPage =
      Math.min(
        Math.max(Number(limit), 1),
        100
      );

    const skip =
      (currentPage - 1) * perPage;

    const filter = {
      isDeleted: false,
    };

    if (status) {
      filter.stockStatus =
        status.toUpperCase();
    }

    let productIds = [];

    if (search) {
      const products =
        await Product.find({
          isDeleted: { $ne: true },
          $or: [
            {
              name: {
                $regex: search,
                $options: "i",
              },
            },
            {
              sku: {
                $regex: search,
                $options: "i",
              },
            },
          ],
        }).select("_id");

      productIds = products.map(
        (product) => product._id
      );

      filter.productId = {
        $in: productIds,
      };
    }

    const [inventory, total] =
      await Promise.all([
        Inventory.find(filter)
          .populate(
            "productId",
            "name sku price images"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage),

        Inventory.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,
      data: inventory,
      pagination: {
        page: currentPage,
        limit: perPage,
        total,
        totalPages:
          Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error(
      "GET INVENTORY ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get inventory",
      error: error.message,
    });
  }
};

// ======================================================
// GET INVENTORY BY PRODUCT
// GET /api/inventory/product/:productId
// ======================================================

exports.getInventoryByProduct = async (
  req,
  res
) => {
  try {
    const { productId } = req.params;

    const inventory =
      await Inventory.findOne({
        productId,
        isDeleted: false,
      }).populate(
        "productId",
        "name sku price images"
      );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get inventory",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE INVENTORY SETTINGS
// PUT /api/inventory/:id
// ======================================================

exports.updateInventory = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const {
      lowStockThreshold,
      reorderQuantity,
      purchasePrice,
      sellingPrice,
    } = req.body;

    const inventory =
      await Inventory.findOne({
        _id: id,
        isDeleted: false,
      });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    if (
      lowStockThreshold !== undefined
    ) {
      inventory.lowStockThreshold =
        Number(lowStockThreshold);
    }

    if (
      reorderQuantity !== undefined
    ) {
      inventory.reorderQuantity =
        Number(reorderQuantity);
    }

    if (
      purchasePrice !== undefined
    ) {
      inventory.purchasePrice =
        Number(purchasePrice);
    }

    if (
      sellingPrice !== undefined
    ) {
      inventory.sellingPrice =
        Number(sellingPrice);
    }

    updateStockStatus(inventory);

    await inventory.save();

    return res.status(200).json({
      success: true,
      message:
        "Inventory updated successfully",
      data: inventory,
    });
  } catch (error) {
    console.error(
      "UPDATE INVENTORY ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update inventory",
      error: error.message,
    });
  }
};

// ======================================================
// ADD STOCK
// POST /api/inventory/stock-in
// ======================================================

exports.stockIn = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      reason = "Stock added",
      note = "",
    } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (
      quantity === undefined ||
      Number(quantity) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be greater than 0",
      });
    }

    const inventory =
      await Inventory.findOne({
        productId,
        isDeleted: false,
      });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    const addQuantity = Number(quantity);

    const previousQuantity =
      inventory.quantity;

    inventory.quantity += addQuantity;

    inventory.lastStockIn = new Date();

    updateStockStatus(inventory);

    await inventory.save();

    await StockHistory.create({
      productId,
      inventoryId: inventory._id,
      type: "STOCK_IN",
      quantity: addQuantity,
      previousQuantity,
      newQuantity: inventory.quantity,
      reason,
      note,
      createdBy:
        req.user?.id ||
        req.user?._id ||
        null,
    });

    return res.status(200).json({
      success: true,
      message: "Stock added successfully",
      data: inventory,
    });
  } catch (error) {
    console.error(
      "STOCK IN ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to add stock",
      error: error.message,
    });
  }
};

// ======================================================
// REMOVE STOCK
// POST /api/inventory/stock-out
// ======================================================

exports.stockOut = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      reason = "Stock removed",
      note = "",
    } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (
      quantity === undefined ||
      Number(quantity) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be greater than 0",
      });
    }

    const inventory =
      await Inventory.findOne({
        productId,
        isDeleted: false,
      });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    const removeQuantity =
      Number(quantity);

    if (
      removeQuantity >
      inventory.availableQuantity
    ) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available quantity: ${inventory.availableQuantity}`,
      });
    }

    const previousQuantity =
      inventory.quantity;

    inventory.quantity -= removeQuantity;

    inventory.lastStockOut = new Date();

    updateStockStatus(inventory);

    await inventory.save();

    await StockHistory.create({
      productId,
      inventoryId: inventory._id,
      type: "STOCK_OUT",
      quantity: removeQuantity,
      previousQuantity,
      newQuantity: inventory.quantity,
      reason,
      note,
      createdBy:
        req.user?.id ||
        req.user?._id ||
        null,
    });

    return res.status(200).json({
      success: true,
      message: "Stock removed successfully",
      data: inventory,
    });
  } catch (error) {
    console.error(
      "STOCK OUT ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to remove stock",
      error: error.message,
    });
  }
};

// ======================================================
// STOCK ADJUSTMENT
// POST /api/inventory/adjust
// ======================================================

exports.adjustStock = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      reason = "Stock adjustment",
      note = "",
    } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (
      quantity === undefined ||
      Number(quantity) < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity cannot be negative",
      });
    }

    const inventory =
      await Inventory.findOne({
        productId,
        isDeleted: false,
      });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    const newQuantity = Number(quantity);

    const previousQuantity =
      inventory.quantity;

    inventory.quantity = newQuantity;

    updateStockStatus(inventory);

    await inventory.save();

    await StockHistory.create({
      productId,
      inventoryId: inventory._id,
      type: "ADJUSTMENT",
      quantity: Math.abs(
        newQuantity - previousQuantity
      ),
      previousQuantity,
      newQuantity,
      reason,
      note,
      createdBy:
        req.user?.id ||
        req.user?._id ||
        null,
    });

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: inventory,
    });
  } catch (error) {
    console.error(
      "ADJUST STOCK ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to adjust stock",
      error: error.message,
    });
  }
};

// ======================================================
// STOCK OVERVIEW
// GET /api/inventory/overview
// ======================================================

exports.getStockOverview = async (
  req,
  res
) => {
  try {
    const [
      totalProducts,
      inStock,
      lowStock,
      outOfStock,
      stockData,
    ] = await Promise.all([
      Inventory.countDocuments({
        isDeleted: false,
        isActive: true,
      }),

      Inventory.countDocuments({
        isDeleted: false,
        isActive: true,
        stockStatus: "IN_STOCK",
      }),

      Inventory.countDocuments({
        isDeleted: false,
        isActive: true,
        stockStatus: "LOW_STOCK",
      }),

      Inventory.countDocuments({
        isDeleted: false,
        isActive: true,
        stockStatus: "OUT_OF_STOCK",
      }),

      Inventory.aggregate([
        {
          $match: {
            isDeleted: false,
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            totalQuantity: {
              $sum: "$quantity",
            },
            totalAvailableQuantity: {
              $sum: "$availableQuantity",
            },
            totalReservedQuantity: {
              $sum: "$reservedQuantity",
            },
            totalStockValue: {
              $sum: {
                $multiply: [
                  "$quantity",
                  "$purchasePrice",
                ],
              },
            },
            totalSellingValue: {
              $sum: {
                $multiply: [
                  "$quantity",
                  "$sellingPrice",
                ],
              },
            },
          },
        },
      ]),
    ]);

    const summary =
      stockData[0] || {
        totalQuantity: 0,
        totalAvailableQuantity: 0,
        totalReservedQuantity: 0,
        totalStockValue: 0,
        totalSellingValue: 0,
      };

    return res.status(200).json({
      success: true,
      data: {
        totalProducts,

        inStock,

        lowStock,

        outOfStock,

        totalQuantity:
          summary.totalQuantity || 0,

        totalAvailableQuantity:
          summary.totalAvailableQuantity ||
          0,

        totalReservedQuantity:
          summary.totalReservedQuantity ||
          0,

        totalStockValue:
          summary.totalStockValue || 0,

        totalSellingValue:
          summary.totalSellingValue || 0,
      },
    });
  } catch (error) {
    console.error(
      "STOCK OVERVIEW ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get stock overview",
      error: error.message,
    });
  }
};

// ======================================================
// LOW STOCK
// GET /api/inventory/low-stock
// ======================================================

exports.getLowStock = async (
  req,
  res
) => {
  try {
    const lowStock =
      await Inventory.find({
        isDeleted: false,
        isActive: true,

        $expr: {
          $and: [
            {
              $gt: [
                "$availableQuantity",
                0,
              ],
            },
            {
              $lte: [
                "$availableQuantity",
                "$lowStockThreshold",
              ],
            },
          ],
        },
      })
        .populate(
          "productId",
          "name sku price images"
        )
        .sort({
          availableQuantity: 1,
        });

    return res.status(200).json({
      success: true,
      count: lowStock.length,
      data: lowStock,
    });
  } catch (error) {
    console.error(
      "LOW STOCK ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get low stock",
      error: error.message,
    });
  }
};

// ======================================================
// OUT OF STOCK
// GET /api/inventory/out-of-stock
// ======================================================

exports.getOutOfStock = async (
  req,
  res
) => {
  try {
    const products =
      await Inventory.find({
        isDeleted: false,
        isActive: true,
        stockStatus: "OUT_OF_STOCK",
      })
        .populate(
          "productId",
          "name sku price images"
        )
        .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error(
      "OUT OF STOCK ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get out of stock products",
      error: error.message,
    });
  }
};

// ======================================================
// STOCK HISTORY
// GET /api/inventory/history/:productId
// ======================================================

exports.getStockHistory = async (
  req,
  res
) => {
  try {
    const { productId } = req.params;

    const history =
      await StockHistory.find({
        productId,
      })
        .populate(
          "productId",
          "name sku"
        )
        .populate(
          "createdBy",
          "name email"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error(
      "STOCK HISTORY ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get stock history",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE INVENTORY
// DELETE /api/inventory/delete/:id
// ======================================================

exports.deleteInventory = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const inventory =
      await Inventory.findOne({
        _id: id,
        isDeleted: false,
      });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    inventory.isDeleted = true;
    inventory.isActive = false;
    inventory.deletedAt = new Date();

    await inventory.save();

    return res.status(200).json({
      success: true,
      message:
        "Inventory deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE INVENTORY ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete inventory",
      error: error.message,
    });
  }
};