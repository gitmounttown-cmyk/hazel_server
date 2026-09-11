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

router.get("/:id", verifyToken, getOrderById);

router.patch("/cancel/:id", verifyToken, cancelOrder);

// =============================================================
// ADMIN
// =============================================================

router.get("/admin/all", verifyToken, getAllOrders);

router.patch(
  "/status/:id",
  verifyToken,
  updateOrderStatus
);

router.patch(
  "/tracking/:id",
  verifyToken,
  updateTracking
);

router.delete(
  "/delete/:id",
  verifyToken,
  deleteOrder
);

// router.patch(
//   "/:id/restore",
//   protect,
//   restoreOrder
// );

module.exports = router;