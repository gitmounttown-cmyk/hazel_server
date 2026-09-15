const express = require("express");

const router = express.Router();

const {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  updateTracking,
  deleteOrder,
} = require("../controllers/orderController");

const { verifyToken } = require("../middleware/authMiddleware");

// =============================================================
// CUSTOMER
// =============================================================

router.post("/create", verifyToken, createOrder);

router.get("/my-orders", verifyToken, getMyOrders);

router.get("/admin/all", verifyToken, getAllOrders);

// =============================================================
// ADMIN
// =============================================================

router.patch("/status/:id", verifyToken, updateOrderStatus);

router.patch("/tracking/:id", verifyToken, updateTracking);

router.delete("/delete/:id", verifyToken, deleteOrder);

// router.patch(
//   "/:id/restore",
//   protect,
//   restoreOrder
// );
router.patch("/cancel/:id", verifyToken, cancelOrder);

router.get("/:id", verifyToken, getOrderById);

module.exports = router;
