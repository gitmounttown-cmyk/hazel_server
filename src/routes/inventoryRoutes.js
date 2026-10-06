const express = require("express");

const router =
  express.Router();

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  getInventorySummary,
  getAllInventory,
  getInventoryById,
  getInventoryByProduct,
  updateStock,
  syncInventory,
  syncAllInventory,
} = require("../controllers/inventoryController");

// ============================================================
// SUMMARY
// ============================================================

router.get(
  "/summary",
  verifyToken,
  getInventorySummary
);

// ============================================================
// ALL INVENTORY
// ============================================================

router.get(
  "/all",
  verifyToken,
  getAllInventory
);

// ============================================================
// SYNC ALL PRODUCTS
// ============================================================

router.post(
  "/sync-all",
  verifyToken,
  syncAllInventory
);

// ============================================================
// GET INVENTORY BY PRODUCT
// ============================================================

router.get(
  "/product/:productId",
  verifyToken,
  getInventoryByProduct
);

// ============================================================
// SYNC ONE PRODUCT
// ============================================================

router.post(
  "/product/:productId/sync",
  verifyToken,
  syncInventory
);

// ============================================================
// UPDATE STOCK
// ============================================================

router.put(
  "/:inventoryId/stock",
  verifyToken,
  updateStock
);

// ============================================================
// GET INVENTORY BY ID
// IMPORTANT: KEEP THIS LAST
// ============================================================

router.get(
  "/:inventoryId",
  verifyToken,
  getInventoryById
);

module.exports = router;