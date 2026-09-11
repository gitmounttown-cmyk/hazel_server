const StockHistory = require("../models/stockHistoryModel");
const Product = require("../models/productModel");
const Inventory = require("../models/inventoryModel");

// ======================================================
// CREATE STOCK HISTORY
// POST /api/stock-history
// ======================================================

exports.createStockHistory = async (req, res) => {
  try {
    const {
      productId,
      inventoryId,
      type,
      quantity,
      previousQuantity,
      newQuantity,
      referenceId,
      referenceType,
      reason,
      note,
    } = req.body;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (
      !productId ||
      !inventoryId ||
      !type ||
      quantity === undefined ||
      previousQuantity === undefined ||
      newQuantity === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "productId, inventoryId, type, quantity, previousQuantity and newQuantity are required",
      });
    }

    // ==========================================
    // CHECK PRODUCT
    // ==========================================

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ==========================================
    // CHECK INVENTORY
    // ==========================================

    const inventory = await Inventory.findById(inventoryId);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    // ==========================================
    // CREATE HISTORY
    // ==========================================

    const stockHistory = await StockHistory.create({
      productId,
      inventoryId,
      type,
      quantity,
      previousQuantity,
      newQuantity,
      referenceId: referenceId || null,
      referenceType: referenceType || "",
      reason: reason || "",
      note: note || "",
      createdBy: req.user?._id || req.user?.id || null,
    });

    // ==========================================
    // POPULATE RESPONSE
    // ==========================================

    const populatedHistory = await StockHistory.findById(
      stockHistory._id
    )
      .populate("productId", "name sku barcode")
      .populate("inventoryId")
      .populate("createdBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Stock history created successfully",
      data: populatedHistory,
    });
  } catch (error) {
    console.error("Create Stock History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create stock history",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL STOCK HISTORY
// GET /api/stock-history
// ======================================================

exports.getAllStockHistory = async (req, res) => {
  try {
    const {
      productId,
      inventoryId,
      type,
      referenceType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    // ==========================================
    // FILTER
    // ==========================================

    const filter = {};

    if (productId) {
      filter.productId = productId;
    }

    if (inventoryId) {
      filter.inventoryId = inventoryId;
    }

    if (type) {
      filter.type = type;
    }

    if (referenceType) {
      filter.referenceType = referenceType;
    }

    // ==========================================
    // DATE FILTER
    // ==========================================

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    // ==========================================
    // PAGINATION
    // ==========================================

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.min(Math.max(Number(limit), 1), 100);

    const skip = (pageNumber - 1) * limitNumber;

    // ==========================================
    // QUERY
    // ==========================================

    const [histories, total] = await Promise.all([
      StockHistory.find(filter)
        .populate("productId", "name sku barcode")
        .populate("inventoryId")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      StockHistory.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Stock history fetched successfully",
      data: histories,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get Stock History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock history",
      error: error.message,
    });
  }
};

// ======================================================
// GET STOCK HISTORY BY ID
// GET /api/stock-history/:id
// ======================================================

exports.getStockHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await StockHistory.findById(id)
      .populate("productId", "name sku barcode")
      .populate("inventoryId")
      .populate("createdBy", "name email");

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Stock history not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock history fetched successfully",
      data: history,
    });
  } catch (error) {
    console.error("Get Stock History By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock history",
      error: error.message,
    });
  }
};

// ======================================================
// GET PRODUCT STOCK HISTORY
// GET /api/stock-history/product/:productId
// ======================================================

exports.getProductStockHistory = async (req, res) => {
  try {
    const { productId } = req.params;

    const histories = await StockHistory.find({
      productId,
    })
      .populate("productId", "name sku barcode")
      .populate("inventoryId")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Product stock history fetched successfully",
      count: histories.length,
      data: histories,
    });
  } catch (error) {
    console.error("Get Product Stock History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product stock history",
      error: error.message,
    });
  }
};

// ======================================================
// GET INVENTORY STOCK HISTORY
// GET /api/stock-history/inventory/:inventoryId
// ======================================================

exports.getInventoryStockHistory = async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const histories = await StockHistory.find({
      inventoryId,
    })
      .populate("productId", "name sku barcode")
      .populate("inventoryId")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Inventory stock history fetched successfully",
      count: histories.length,
      data: histories,
    });
  } catch (error) {
    console.error("Get Inventory Stock History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory stock history",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE STOCK HISTORY
// DELETE /api/stock-history/:id
// ======================================================

exports.deleteStockHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await StockHistory.findByIdAndDelete(id);

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Stock history not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock history deleted successfully",
    });
  } catch (error) {
    console.error("Delete Stock History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete stock history",
      error: error.message,
    });
  }
};