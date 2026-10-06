const Inventory = require("../models/inventoryModel");
const Product = require("../models/productModel");

const {
  syncProductInventory,
  syncAllProductInventory,
  updateProductSizeStock,
} = require("../services/inventoryService");

// ============================================================
// GET INVENTORY SUMMARY
// ============================================================

exports.getInventorySummary = async (
  req,
  res
) => {
  try {
    // Only count inventory belonging to non-deleted products
    const activeProducts =
      await Product.find({
        isDeleted: {
          $ne: true,
        },
      }).select("_id");

    const productIds =
      activeProducts.map(
        (product) => product._id
      );

    const totalProducts =
      await Inventory.countDocuments({
        productId: {
          $in: productIds,
        },
      });

    const lowStockItems =
      await Inventory.countDocuments({
        productId: {
          $in: productIds,
        },

        stockStatus:
          "LOW_STOCK",
      });

    const outOfStockItems =
      await Inventory.countDocuments({
        productId: {
          $in: productIds,
        },

        stockStatus:
          "OUT_OF_STOCK",
      });

    const inStockItems =
      await Inventory.countDocuments({
        productId: {
          $in: productIds,
        },

        stockStatus:
          "IN_STOCK",
      });

    return res.status(200).json({
      success: true,

      data: {
        totalProducts,
        lowStockItems,
        outOfStockItems,
        inStockItems,
      },
    });
  } catch (error) {
    console.error(
      "getInventorySummary error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to get inventory summary",
    });
  }
};

// ============================================================
// GET ALL INVENTORY
// ============================================================

exports.getAllInventory = async (
  req,
  res
) => {
  try {
    const page = Math.max(
      1,
      parseInt(
        req.query.page,
        10
      ) || 1
    );

    const limit = Math.max(
      1,
      parseInt(
        req.query.limit,
        10
      ) || 20
    );

    const skip =
      (page - 1) * limit;

    const filter = {};

    // ----------------------------------------------------------
    // STATUS
    // ----------------------------------------------------------

    if (req.query.status) {
      filter.stockStatus =
        req.query.status;
    }

    // ----------------------------------------------------------
    // SEARCH
    // ----------------------------------------------------------

    if (req.query.search) {
      const search =
        req.query.search.trim();

      if (search) {
        const matchingProducts =
          await Product.find({
            isDeleted: {
              $ne: true,
            },

            $or: [
              {
                name: {
                  $regex: search,
                  $options: "i",
                },
              },

              {
                "variants.color": {
                  $regex: search,
                  $options: "i",
                },
              },

              {
                "variants.sizes.sku": {
                  $regex: search,
                  $options: "i",
                },
              },

              {
                "variants.sizes.barcode": {
                  $regex: search,
                  $options: "i",
                },
              },
            ],
          }).select("_id");

        const productIds =
          matchingProducts.map(
            (product) =>
              product._id
          );

        filter.productId = {
          $in: productIds,
        };
      }
    }

    // ----------------------------------------------------------
    // COUNT
    // ----------------------------------------------------------

    const total =
      await Inventory.countDocuments(
        filter
      );

    // ----------------------------------------------------------
    // DATA
    // ----------------------------------------------------------

    const inventory =
      await Inventory.find(filter)
        .populate({
          path: "productId",

          select:
            "name categoryId brandId variants isActive isDeleted",

          populate: [
            {
              path: "categoryId",
              select: "name",
            },

            {
              path: "brandId",
              select: "name",
            },
          ],
        })

        .sort({
          updatedAt: -1,
        })

        .skip(skip)

        .limit(limit)

        .lean();

    return res.status(200).json({
      success: true,

      count:
        inventory.length,

      total,

      page,

      pages:
        Math.ceil(
          total / limit
        ) || 1,

      data: inventory,
    });
  } catch (error) {
    console.error(
      "getAllInventory error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to get inventory",
    });
  }
};

// ============================================================
// GET INVENTORY BY ID
// ============================================================

exports.getInventoryById = async (
  req,
  res
) => {
  try {
    const {
      inventoryId,
    } = req.params;

    const inventory =
      await Inventory.findById(
        inventoryId
      ).populate({
        path: "productId",

        populate: [
          {
            path: "categoryId",
            select: "name",
          },

          {
            path: "brandId",
            select: "name",
          },
        ],
      });

    if (!inventory) {
      return res.status(404).json({
        success: false,

        message:
          "Inventory not found",
      });
    }

    return res.status(200).json({
      success: true,

      data: inventory,
    });
  } catch (error) {
    console.error(
      "getInventoryById error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to get inventory",
    });
  }
};

// ============================================================
// GET INVENTORY BY PRODUCT
// ============================================================

exports.getInventoryByProduct =
  async (req, res) => {
    try {
      const {
        productId,
      } = req.params;

      const inventory =
        await Inventory.findOne({
          productId,
        }).populate(
          "productId"
        );

      if (!inventory) {
        return res.status(404).json({
          success: false,

          message:
            "Inventory not found",
        });
      }

      return res.status(200).json({
        success: true,

        data: inventory,
      });
    } catch (error) {
      console.error(
        "getInventoryByProduct error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to get inventory",
      });
    }
  };

// ============================================================
// UPDATE STOCK
// ============================================================

exports.updateStock = async (
  req,
  res
) => {
  try {
    const {
      inventoryId,
    } = req.params;

    const {
      variantId,
      sizeId,
      stockQuantity,
    } = req.body;

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (!variantId || !sizeId) {
      return res.status(400).json({
        success: false,

        message:
          "variantId and sizeId are required",
      });
    }

    const quantity =
      Number(stockQuantity);

    if (
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      return res.status(400).json({
        success: false,

        message:
          "stockQuantity must be a valid number >= 0",
      });
    }

    // ----------------------------------------------------------
    // FIND INVENTORY
    // ----------------------------------------------------------

    const inventory =
      await Inventory.findById(
        inventoryId
      );

    if (!inventory) {
      return res.status(404).json({
        success: false,

        message:
          "Inventory not found",
      });
    }

    // ----------------------------------------------------------
    // FIND PRODUCT
    // ----------------------------------------------------------

    const product =
      await Product.findById(
        inventory.productId
      );

    if (!product) {
      return res.status(404).json({
        success: false,

        message:
          "Product not found",
      });
    }

    // ----------------------------------------------------------
    // UPDATE PRODUCT STOCK
    // ----------------------------------------------------------

    const result =
      await updateProductSizeStock({
        product,
        variantId,
        sizeId,
        stockQuantity:
          quantity,
      });

    return res.status(200).json({
      success: true,

      message:
        "Stock updated successfully",

      data: {
        inventory:
          result.inventory,

        product:
          result.product,
      },
    });
  } catch (error) {
    console.error(
      "updateStock error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to update stock",
    });
  }
};

// ============================================================
// SYNC ONE PRODUCT
// ============================================================

exports.syncInventory = async (
  req,
  res
) => {
  try {
    const {
      productId,
    } = req.params;

    const inventory =
      await syncProductInventory(
        productId,
        {
          notify: true,
        }
      );

    return res.status(200).json({
      success: true,

      message:
        "Inventory synchronized successfully",

      data: inventory,
    });
  } catch (error) {
    console.error(
      "syncInventory error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to synchronize inventory",
    });
  }
};

// ============================================================
// SYNC ALL PRODUCTS
// ============================================================

exports.syncAllInventory = async (
  req,
  res
) => {
  try {
    const result =
      await syncAllProductInventory();

    return res.status(200).json({
      success: true,

      message:
        "All inventory synchronized successfully",

      data: result,
    });
  } catch (error) {
    console.error(
      "syncAllInventory error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to synchronize all inventory",
    });
  }
};