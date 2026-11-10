const mongoose = require("mongoose");
const Inventory = require("../models/inventoryModel");
const Product = require("../models/productModel");
require("../models/categoryModel");
require("../models/brandModel");

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
        isActive: true,
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
        isEnabled: { $ne: false },

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

      // Calculate total units from all variant sizes
    const stockAggregation = await Product.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: { $ne: true },
        },
      },
      {
        $unwind: "$variants",
      },
      {
        $unwind: "$variants.sizes",
      },
      {
        $group: {
          _id: null,
          totalUnits: {
            $sum: {
              $ifNull: [
                "$variants.sizes.stockQuantity",
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalUnits =
      stockAggregation[0]?.totalUnits || 0;

    return res.status(200).json({
      success: true,

      data: {
        totalProducts,
        lowStockItems,
        outOfStockItems,
        inStockItems,
        totalUnits,
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

// exports.getAllInventory = async (
//   req,
//   res
// ) => {
//   try {
//     const page = Math.max(
//       1,
//       parseInt(
//         req.query.page,
//         10
//       ) || 1
//     );

//     const limit = Math.max(
//       1,
//       parseInt(
//         req.query.limit,
//         10
//       ) || 20
//     );

//     const skip =
//       (page - 1) * limit;

//     const filter = {};

//     // Get only active products
//     const activeProducts = await Product.find({
//       isActive: true,
//       isDeleted: { $ne: true },
//     }).select("_id");

//     const activeProductIds = activeProducts.map(
//       (product) => product._id
//     );

//     // Always show inventory for active products only
//     // filter.productId = {
//     //   $in: activeProductIds,
//     // };

//     filter.productId = {
//   $in: productIds.filter((id) =>
//     activeProductIds.some(
//       (activeId) => activeId.equals(id)
//     )
//   ),
// };

//     // ----------------------------------------------------------
//     // STATUS
//     // ----------------------------------------------------------

//     if (req.query.status) {
//       filter.stockStatus =
//         req.query.status;
//     }

//     // ----------------------------------------------------------
//     // SEARCH
//     // ----------------------------------------------------------

//     if (req.query.search) {
//       const search =
//         req.query.search.trim();

//       if (search) {
//         const matchingProducts =
//           await Product.find({
//             isActive: true,
//             isDeleted: {
//               $ne: true,
//             },

//             $or: [
//               {
//                 name: {
//                   $regex: search,
//                   $options: "i",
//                 },
//               },

//               {
//                 "variants.color": {
//                   $regex: search,
//                   $options: "i",
//                 },
//               },

//               {
//                 "variants.sizes.sku": {
//                   $regex: search,
//                   $options: "i",
//                 },
//               },

//               {
//                 "variants.sizes.barcode": {
//                   $regex: search,
//                   $options: "i",
//                 },
//               },
//             ],
//           }).select("_id");

//         const productIds =
//           matchingProducts.map(
//             (product) =>
//               product._id
//           );

//         filter.productId = {
//           $in: productIds,
//         };
//       }
//     }

//     // ----------------------------------------------------------
//     // COUNT
//     // ----------------------------------------------------------

//     const total =
//       await Inventory.countDocuments(
//         filter
//       );

//     // ----------------------------------------------------------
//     // DATA
//     // ----------------------------------------------------------
// console.log("Filter:", filter);
//     const inventory =
//       await Inventory.find(filter)
//         .populate({
//           path: "productId",

//           select:
//             "name categoryId brandId variants isActive isDeleted",

//           populate: [
//             {
//               path: "categoryId",
//               select: "name",
//             },

//             {
//               path: "brandId",
//               select: "name",
//             },
//           ],
//         })

//         .sort({
//           updatedAt: -1,
//         })

//         .skip(skip)

//         .limit(limit)

//         .lean();

//     return res.status(200).json({
//       success: true,

//       count:
//         inventory.length,

//       total,

//       page,

//       pages:
//         Math.ceil(
//           total / limit
//         ) || 1,

//       data: inventory,
//     });
//   } catch (error) {
//     console.error(
//       "getAllInventory error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,

//       message:
//         error.message ||
//         "Failed to get inventory",
//     });
//   }
// };

exports.getAllInventory = async (req, res) => {
  try {
    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.max(
      1,
      parseInt(req.query.limit, 10) || 20
    );

    const skip = (page - 1) * limit;

    const filter = {};

    // Get only active products
    const activeProducts = await Product.find({
      isActive: true,
      isDeleted: { $ne: true },
    }).select("_id");
console.log("Active Products:", activeProducts);
    const activeProductIds = activeProducts.map(
      (product) => product._id
    );

    // Always restrict inventory to active products
    filter.productId = {
      $in: activeProductIds,
    };

    // STATUS
    if (req.query.status) {
      filter.stockStatus = req.query.status;
    }

    // SEARCH
    if (req.query.search?.trim()) {
      // const search = req.query.search.trim();

    const productFilter = {
      isDeleted: {
        $ne: true,
      },
    };

    if (req.query.search) {
      const search = req.query.search.trim();
      if (search) {
        productFilter.$or = [
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
        ];
      }
    }

    const matchingProducts = await Product.find(productFilter).select("_id");
    const productIds = matchingProducts.map((product) => product._id);
    filter.productId = {
      $in: productIds,
    };

    filter.isEnabled = { $ne: false };

    // ----------------------------------------------------------
    // COUNT
    // ----------------------------------------------------------

    // const total =
    //   await Inventory.countDocuments(
    //     filter
    //   );

      filter.productId = {
        $in: productIds,
      };
    }

    // COUNT
    const total = await Inventory.countDocuments(filter);

    // DATA
    const inventory = await Inventory.find(filter)
      .populate({
        path: "productId",
        select: "name categoryId brandId variants isActive isDeleted",
        populate: [
          { path: "categoryId", select: "name" },
          { path: "brandId", select: "name" },
        ],
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: inventory.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      data: inventory,
    });

  } catch (error) {
    console.error("getAllInventory error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get inventory",
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

// ============================================================
// DELETE PRODUCT FROM INVENTORY
// ============================================================

exports.deleteInventory = async (req, res) => {
  try {
    const { inventoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(inventoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid inventory ID",
      });
    }

    const inventory = await Inventory.findById(inventoryId);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    if (inventory.isEnabled === false) {
      return res.status(400).json({
        success: false,
        message: "Product is already removed from inventory",
      });
    }

    // Disable inventory without deleting the Product
    inventory.isEnabled = false;

    await inventory.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from inventory successfully",
      data: inventory,
    });
  } catch (error) {
    console.error("deleteInventory error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove product inventory",
    });
  }
};

// ============================================================
// DELETE SIZE FROM INVENTORY
// ============================================================

exports.deleteInventorySize = async (req, res) => {
  try {
    const {
      inventoryId,
      variantId,
      sizeId,
    } = req.params;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(inventoryId) ||
      !mongoose.Types.ObjectId.isValid(variantId) ||
      !mongoose.Types.ObjectId.isValid(sizeId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid inventory, variant or size ID",
      });
    }

    const inventory = await Inventory.findById(inventoryId);

    if (!inventory || inventory.isEnabled === false) {
      return res.status(404).json({
        success: false,
        message: "Active inventory not found",
      });
    }

    // Find product
    const product = await Product.findById(inventory.productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find product variant
    const variant = product.variants.find(
      (item) => String(item._id) === variantId
    );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    // Find product size
    const size = variant.sizes.find(
      (item) => String(item._id) === sizeId
    );

    if (!size || size.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Active product size not found",
      });
    }

    // Deactivate size in Product collection
    size.isActive = false;

    await product.save();

    // Synchronize inventory from Product
    const updatedInventory = await syncProductInventory(
      product._id
    );

    return res.status(200).json({
      success: true,
      message: `Size ${size.size} removed successfully`,
      data: {
        inventory: updatedInventory,
        product,
      },
    });
  } catch (error) {
    console.error("deleteInventorySize error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove size",
    });
  }
};