const express = require("express");

const router = express.Router();

const {
  createOrder,
  getUserOverview,
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
// CUSTOMER ROUTES
// =============================================================

// User Overview Dashboard (Recent Orders, Profile Details, Saved Address, Wishlist)
router.get("/user-overview", verifyToken, getUserOverview);

// Create New Order
router.post("/create", verifyToken, createOrder);

// Fetch User Orders List
router.get("/my-orders", verifyToken, getMyOrders);

// Cancel Order
router.patch("/cancel/:id", verifyToken, cancelOrder);

// Fetch Single Order Details
router.get("/:id", verifyToken, getOrderById);

// =============================================================
// ADMIN ROUTES
// =============================================================

// Fetch All Orders
router.get("/admin/all", verifyToken, getAllOrders);

// Update Status (CONFIRMED, PACKED, SHIPPED, DELIVERED)
router.patch("/status/:id", verifyToken, updateOrderStatus);

// Update Courier Tracking Details
router.patch("/tracking/:id", verifyToken, updateTracking);

// Soft Delete Order
router.delete("/delete/:id", verifyToken, deleteOrder);

module.exports = router;