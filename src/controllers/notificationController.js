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
    const { guestId } = req.query;
    let notifications;

    if (userId) {
      notifications = await Notification.find({
        userId,
        isDeleted: false,
      })
        .populate("order", "orderNumber orderStatus")
        .populate("product", "name")
        .sort({ createdAt: -1 });
    } else if (guestId) {
      notifications = await Notification.find({
        guestId,
        isDeleted: false,
      })
        .populate("order", "orderNumber orderStatus")
        .populate("product", "name")
        .sort({ createdAt: -1 });
    }

    let unreadCount = 0;
    if (userId) {
      unreadCount = await Notification.countDocuments({
        userId,
        isDeleted: false,
        isRead: false,
      });
    } else if (guestId) {
      unreadCount = await Notification.countDocuments({
        guestId,
        isDeleted: false,
        isRead: false,
      });
    }

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
    const guestId = req.body.guestId || req.query.guestId;

    let notification;
    if (!userId && !guestId) {
      return res.status(400).json({
        success: false,
        message: "User ID or Guest ID is required",
      });
    }

    if (!req.params.id) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    if (userId) {
      notification = await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          userId,
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
    } else if (guestId) {
      notification = await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          guestId,
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
    }

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
    const guestId = req.body.guestId || req.query.guestId;
    
    if (!userId && !guestId) {
      return res.status(400).json({
        success: false,
        message: "User ID or Guest ID is required",
      });
    }
    if (guestId) {
      await Notification.updateMany(
        {
          guestId,
          isDeleted: false,
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        }
      );
    } else {
      await Notification.updateMany(
        {
          userId,
          isDeleted: false,
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        }
      );
    }


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
          userId,
          guestId,
          isDeleted: false,
        },
        {
          isDeleted: true,
          deletedAt: new Date(),
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

// =============================================================
// Get All Notifications - Admin
// GET /api/notifications/all
// =============================================================
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({});
    return res.json({
      success: true,
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
