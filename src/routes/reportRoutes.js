const express = require("express");

const router = express.Router();

const {
  getSalesReport,
  getCustomerReport,
  getReports,
  getReportById,
  deleteReport,
} = require("../controllers/reportController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

// ============================================================
// GET ALL REPORTS
// ============================================================

router.get(
  "/all",
  verifyToken,
  getReports
);

// ============================================================
// SALES REPORT
// ============================================================

router.get(
  "/sales",
  verifyToken,
  getSalesReport
);

// ============================================================
// CUSTOMER REPORT
// ============================================================

router.get(
  "/customers",
  verifyToken,
  getCustomerReport
);

// ============================================================
// GET REPORT BY ID
// ============================================================

router.get(
  "/:id",
  verifyToken,
  getReportById
);

// ============================================================
// DELETE REPORT
// ============================================================

router.delete(
  "/delete/:id",
  verifyToken,
  deleteReport
);

module.exports = router;