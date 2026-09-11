const express = require("express");

const router = express.Router();

const stockHistoryController = require("../controllers/stockHistoryController");

const { verifyToken } = require("../middleware/authMiddleware");

// ======================================================
// CREATE
// ======================================================

router.post(
  "/create",
  verifyToken,
  stockHistoryController.createStockHistory
);

// ======================================================
// GET ALL
// ======================================================

router.get(
  "/all",
  verifyToken,
  stockHistoryController.getAllStockHistory
);

// ======================================================
// PRODUCT HISTORY
// IMPORTANT: Keep this BEFORE /:id
// ======================================================

router.get(
  "/product/:productId",
  verifyToken,
  stockHistoryController.getProductStockHistory
);

// ======================================================
// INVENTORY HISTORY
// ======================================================

router.get(
  "/inventory/:inventoryId",
  verifyToken,
  stockHistoryController.getInventoryStockHistory
);

// ======================================================
// GET BY ID
// ======================================================

router.get(
  "/:id",
  verifyToken,
  stockHistoryController.getStockHistoryById
);

// ======================================================
// DELETE
// ======================================================

router.delete(
  "/delete/:id",
  verifyToken,
  stockHistoryController.deleteStockHistory
);

module.exports = router;