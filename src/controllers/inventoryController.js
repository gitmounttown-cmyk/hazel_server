const Inventory = require("../models/inventoryModel");
const StockHistory = require("../models/stockHistoryModel");
const Product = require("../models/productModel");

const updateStockStatus = (inventory) => {
  inventory.availableQuantity = Math.max(0, inventory.quantity - inventory.reservedQuantity);
  if (inventory.availableQuantity <= 0) {
    inventory.stockStatus = "OUT_OF_STOCK";
  } else if (inventory.availableQuantity <= inventory.lowStockThreshold) {
    inventory.stockStatus = "LOW_STOCK";
  } else {
    inventory.stockStatus = "IN_STOCK";
  }
};

exports.getAllInventory = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const filter = { isDeleted: false };

    if (status) filter.stockStatus = status.toUpperCase();

    if (search) {
      const products = await Product.find({
        isDeleted: { $ne: true },
        $or: [
          { name: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      filter.productId = { $in: products.map((p) => p._id) };
    }

    const [inventory, total] = await Promise.all([
      Inventory.find(filter)
        .populate("productId", "name sku price images")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Inventory.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: inventory,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStockOverview = async (req, res) => {
  try {
    const [totalProducts, inStock, lowStock, outOfStock, stockData] = await Promise.all([
      Inventory.countDocuments({ isDeleted: false, isActive: true }),
      Inventory.countDocuments({ isDeleted: false, isActive: true, stockStatus: "IN_STOCK" }),
      Inventory.countDocuments({ isDeleted: false, isActive: true, stockStatus: "LOW_STOCK" }),
      Inventory.countDocuments({ isDeleted: false, isActive: true, stockStatus: "OUT_OF_STOCK" }),
      Inventory.aggregate([
        { $match: { isDeleted: false, isActive: true } },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
            totalAvailableQuantity: { $sum: "$availableQuantity" },
            totalReservedQuantity: { $sum: "$reservedQuantity" },
            totalStockValue: { $sum: { $multiply: ["$quantity", "$purchasePrice"] } },
            totalSellingValue: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } },
          },
        },
      ]),
    ]);

    const summary = stockData[0] || {};
    return res.status(200).json({
      success: true,
      data: {
        totalProducts,
        inStock,
        lowStock,
        outOfStock,
        totalQuantity: summary.totalQuantity || 0,
        totalAvailableQuantity: summary.totalAvailableQuantity || 0,
        totalReservedQuantity: summary.reservedQuantity || 0,
        totalStockValue: summary.totalStockValue || 0,
        totalSellingValue: summary.totalSellingValue || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLowStock = async (req, res) => {
  try {
    const lowStock = await Inventory.find({
      isDeleted: false,
      isActive: true,
      $expr: {
        $and: [
          { $gt: ["$availableQuantity", 0] },
          { $lte: ["$availableQuantity", "$lowStockThreshold"] },
        ],
      },
    })
      .populate("productId", "name sku price images")
      .sort({ availableQuantity: 1 });

    return res.status(200).json({ success: true, count: lowStock.length, data: lowStock });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.stockIn = async (req, res) => {
  try {
    const { productId, quantity, reason = "Stock added" } = req.body;
    const inventory = await Inventory.findOne({ productId, isDeleted: false });
    if (!inventory) return res.status(404).json({ success: false, message: "Inventory not found" });

    const addQuantity = Number(quantity);
    const previousQuantity = inventory.quantity;
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
      createdBy: req.user?.id || req.user?._id || null,
    });

    return res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.stockOut = async (req, res) => {
  try {
    const { productId, quantity, reason = "Stock removed" } = req.body;
    const inventory = await Inventory.findOne({ productId, isDeleted: false });
    if (!inventory) return res.status(404).json({ success: false, message: "Inventory not found" });

    const removeQuantity = Number(quantity);
    if (removeQuantity > inventory.availableQuantity) {
      return res.status(400).json({ success: false, message: "Insufficient stock" });
    }

    const previousQuantity = inventory.quantity;
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
      createdBy: req.user?.id || req.user?._id || null,
    });

    return res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};