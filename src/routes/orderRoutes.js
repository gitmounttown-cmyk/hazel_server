const express = require("express");
const router = express.Router();

const {
  createOrder,
  getUserOverview,
  getMyOrders,
  getOrderById,
  generateInvoice,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  updateTracking,
  deleteOrder,
} = require("../controllers/orderController");

const { verifyToken } = require("../middleware/authMiddleware");

// =============================================================
// CUSTOMER ROUTES
// =============================================================

router.get("/user-overview", verifyToken, getUserOverview);

router.post("/create", verifyToken, createOrder);

router.get("/my-orders", verifyToken, getMyOrders);

router.patch("/cancel/:id", verifyToken, cancelOrder);

router.get("/:id/invoice", verifyToken, generateInvoice);

router.get("/:id", verifyToken, getOrderById);

// =============================================================
// ADMIN ROUTES
// =============================================================

router.get("/admin/all", verifyToken, getAllOrders);

router.patch("/status/:id", verifyToken, updateOrderStatus);

router.patch("/tracking/:id", verifyToken, updateTracking);

router.delete("/delete/:id", verifyToken, deleteOrder);

module.exports = router;