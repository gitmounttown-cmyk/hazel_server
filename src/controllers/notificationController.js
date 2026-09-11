const Notification = require("../models/notificationModel");
const getUserId = (req) =>
  req.user?.id || req.user?._id || req.user?.userId;

// =============================================================
// CREATE NOTIFICATION - ADMIN
// POST /api/notifications/create
// =============================================================

exports.createNotification = async (req, res) => {
  try {
    const notification = await Notification.create(
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create notification",
      error: error.message,
    });
  }
};

// =============================================================
// GET MY NOTIFICATIONS
// GET /api/notifications/my
// =============================================================

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = getUserId(req);

    const notifications = await Notification.find({
      user: userId,
      isDeleted: false,
    })
      .populate("order", "orderNumber orderStatus")
      .populate("product", "name")
      .sort({ createdAt: -1 });

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isDeleted: false,
      isRead: false,
    });

    return res.json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// =============================================================
// MARK AS READ
// PATCH /api/notifications/:id/read
// =============================================================

exports.markAsRead = async (req, res) => {
  try {
    const userId = getUserId(req);

    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          user: userId,
          isDeleted: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        },
        {
          new: true,
        }
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

// =============================================================
// MARK ALL AS READ
// PATCH /api/notifications/read-all
// =============================================================

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = getUserId(req);

    await Notification.updateMany(
      {
        user: userId,
        isDeleted: false,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update notifications",
      error: error.message,
    });
  }
};

// =============================================================
// DELETE NOTIFICATION
// DELETE /api/notifications/:id
// =============================================================

exports.deleteNotification = async (req, res) => {
  try {
    const userId = getUserId(req);

    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          user: userId,
        },
        {
          isDeleted: true,
        },
        {
          new: true,
        }
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};

// =============================================================
// ADMIN - SEND NOTIFICATION TO USER
// POST /api/notifications/admin/send
// =============================================================

exports.sendNotificationToUser = async (req, res) => {
  try {
    const {
      userId,
      title,
      message,
      type = "SYSTEM",
      order = null,
      product = null,
      redirectType = "NONE",
      redirectId = null,
      redirectUrl = "",
    } = req.body;

    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      order,
      product,
      redirectType,
      redirectId,
      redirectUrl,
    });

    return res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: error.message,
    });
  }
};