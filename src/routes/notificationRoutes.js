const express = require("express");

const router = express.Router();

const {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendNotificationToUser
} = require("../controllers/notificationController");

const { verifyToken } = require("../middleware/authMiddleware");

// =============================================================
// CUSTOMER
// =============================================================

router.get(
  "/my",
  verifyToken,
  getMyNotifications
);

router.patch(
  "/read-all",
  verifyToken,
  markAllAsRead
);

router.patch(
  "/read/:id",
  verifyToken,
  markAsRead
);

router.delete(
  "/delete/:id",
  verifyToken,
  deleteNotification
);

// =============================================================
// ADMIN
// =============================================================

router.post(
  "/create",
  verifyToken,
  createNotification
);

router.post(
  "/admin/send",
  verifyToken,
  sendNotificationToUser
);

module.exports = router;