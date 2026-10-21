const express = require("express");

const router = express.Router();

const {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendNotificationToUser,
  getAllNotifications,
} = require("../controllers/notificationController");

const { verifyToken, optionalAuth } = require("../middleware/authMiddleware");

// =============================================================
// CUSTOMER
// =============================================================

// router.get(
//   "/my",
//   verifyToken,
//   getMyNotifications
// );

router.get("/my", optionalAuth, getMyNotifications);

// router.patch(
//   "/read-all",
//   verifyToken,
//   markAllAsRead
// );

router.patch("/read-all", optionalAuth, markAllAsRead);

// router.patch(
//   "/read/:id",
//   verifyToken,
//   markAsRead
// );

router.patch("/read/:id", optionalAuth, markAsRead);

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

router.get("/all", optionalAuth, getAllNotifications);

module.exports = router;