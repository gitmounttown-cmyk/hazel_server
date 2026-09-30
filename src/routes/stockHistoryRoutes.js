const express = require("express");
const router = express.Router();
const stockHistoryController = require("../controllers/stockHistoryController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/create", verifyToken, stockHistoryController.createStockHistory);
router.get("/all", verifyToken, stockHistoryController.getAllStockHistory);
router.get("/product/:productId", verifyToken, stockHistoryController.getProductStockHistory);
router.get("/inventory/:inventoryId", verifyToken, stockHistoryController.getInventoryStockHistory);
router.get("/:id", verifyToken, stockHistoryController.getStockHistoryById);
router.delete("/delete/:id", verifyToken, stockHistoryController.deleteStockHistory);

module.exports = router;