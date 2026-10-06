const express = require("express");

const router =
  express.Router();

const {
  verifyToken,
} = require("../middleware/authMiddleware");

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

// =============================================================
// CUSTOMER ROUTES
// =============================================================

// User dashboard
router.get(
  "/user-overview",
  verifyToken,
  getUserOverview
);

// COD order
router.post(
  "/create",
  verifyToken,
  createOrder
);

// User orders
router.get(
  "/my-orders",
  verifyToken,
  getMyOrders
);

// Cancel order
router.patch(
  "/cancel/:id",
  verifyToken,
  cancelOrder
);

// Invoice
router.get(
  "/:id/invoice",
  verifyToken,
  generateInvoice
);

// Single order
router.get(
  "/:id",
  verifyToken,
  getOrderById
);

// =============================================================
// ADMIN ROUTES
// =============================================================

router.get(
  "/admin/all",
  verifyToken,
  getAllOrders
);

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

module.exports =
  router;