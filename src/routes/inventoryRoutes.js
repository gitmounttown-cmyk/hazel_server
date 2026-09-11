const express = require("express");

const router = express.Router();

const inventoryController = require("../controllers/inventoryController");

// If you have authentication middleware
const { verifyToken } = require("../middleware/authMiddleware");

// ======================================================
// CREATE INVENTORY
// POST /api/inventory/create
// ======================================================
router.post(
  "/create",
  verifyToken,
  inventoryController.createInventory
);

// ======================================================
// GET ALL INVENTORY
// GET /api/inventory/all
// ======================================================
router.get(
  "/all",
  verifyToken,
  inventoryController.getAllInventory
);

// ======================================================
// GET INVENTORY BY PRODUCT
// GET /api/inventory/product/:productId
// ======================================================
router.get(
  "/product/:productId",
  verifyToken,
  inventoryController.getInventoryByProduct
);

// ======================================================
// UPDATE INVENTORY SETTINGS
// PUT /api/inventory/:id
// ======================================================
router.put(
  "/:id",
  verifyToken,
  inventoryController.updateInventory
);

// ======================================================
// STOCK IN
// POST /api/inventory/stock-in
// ======================================================
router.post(
  "/stock-in",
  verifyToken,
  inventoryController.stockIn
);

// ======================================================
// STOCK OUT
// POST /api/inventory/stock-out
// ======================================================
router.post(
  "/stock-out",
  verifyToken,
  inventoryController.stockOut
);

// ======================================================
// STOCK ADJUSTMENT
// POST /api/inventory/adjust
// ======================================================
router.post(
  "/adjust",
  verifyToken,
  inventoryController.adjustStock
);

// ======================================================
// STOCK OVERVIEW
// GET /api/inventory/overview
// ======================================================
router.get(
  "/overview",
  verifyToken,
  inventoryController.getStockOverview
);

// ======================================================
// LOW STOCK
// GET /api/inventory/low-stock
// ======================================================
router.get(
  "/low-stock",
  verifyToken,
  inventoryController.getLowStock
);

// ======================================================
// OUT OF STOCK
// GET /api/inventory/out-of-stock
// ======================================================
router.get(
  "/out-of-stock",
  verifyToken,
  inventoryController.getOutOfStock
);

// ======================================================
// STOCK HISTORY
// GET /api/inventory/history/:productId
// ======================================================
router.get(
  "/history/:productId",
  verifyToken,
  inventoryController.getStockHistory
);

// ======================================================
// DELETE INVENTORY
// DELETE /api/inventory/delete/:id
// ======================================================
router.delete(
  "/delete/:id",
  verifyToken,
  inventoryController.deleteInventory
);

module.exports = router;