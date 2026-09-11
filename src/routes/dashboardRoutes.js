const express = require("express");

const router = express.Router();

const {
  getDashboard,
  getDashboardSummary,
  getSalesOverview,
  getRecentOrders,
  getTopSellingProducts,
  getInventoryStatus,
  getRecentActivities,
} = require("../controllers/dashboardController");

// ============================================================
// COMPLETE DASHBOARD
// GET /api/dashboard
// ============================================================

router.get("/", getDashboard);

// ============================================================
// COMPLETE DASHBOARD - OPTIONAL ALIAS
// GET /api/dashboard/all
// ============================================================

router.get("/all", getDashboard);

// ============================================================
// DASHBOARD SUMMARY
// GET /api/dashboard/summary
// ============================================================

router.get("/summary", getDashboardSummary);

// ============================================================
// SALES OVERVIEW
// GET /api/dashboard/sales-overview?range=today
// GET /api/dashboard/sales-overview?range=week
// GET /api/dashboard/sales-overview?range=month
// ============================================================

router.get("/sales-overview", getSalesOverview);

// ============================================================
// RECENT ORDERS
// GET /api/dashboard/recent-orders
// ============================================================

router.get("/recent-orders", getRecentOrders);

// ============================================================
// TOP SELLING PRODUCTS
// GET /api/dashboard/top-products
// ============================================================

router.get("/top-products", getTopSellingProducts);

// ============================================================
// INVENTORY STATUS
// GET /api/dashboard/inventory
// ============================================================

router.get("/inventory", getInventoryStatus);

// ============================================================
// RECENT ACTIVITIES
// GET /api/dashboard/activities
// ============================================================

router.get("/activities", getRecentActivities);

module.exports = router;