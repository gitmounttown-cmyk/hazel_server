const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/all", verifyToken, inventoryController.getAllInventory);
router.get("/overview", verifyToken, inventoryController.getStockOverview);
router.get("/low-stock", verifyToken, inventoryController.getLowStock);
router.post("/stock-in", verifyToken, inventoryController.stockIn);
router.post("/stock-out", verifyToken, inventoryController.stockOut);

module.exports = router;