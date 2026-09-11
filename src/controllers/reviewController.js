const Review = require("../models/reviewModel");
const Order = require("../models/orderModel");
const OrderItem = require("../models/orderItemModel");
const Product = require("../models/productModel");

const getUserId = (req) =>
  req.user?.id || req.user?._id || req.user?.userId;

// =============================================================
// CREATE REVIEW
// POST /api/reviews/create
// =============================================================

exports.createReview = async (req, res) => {
  try {
    const userId = getUserId(req);

    const {
      productId,
      orderId,
      orderItemId,
      rating,
      title,
      comment,
      images = [],
    } = req.body;

    console.log("=================================");
    console.log("CREATE REVIEW");
    console.log("userId:", userId);
    console.log("productId:", productId);
    console.log("orderId:", orderId);
    console.log("orderItemId:", orderItemId);
    console.log("=================================");

    // =========================================================
    // CHECK USER
    // =========================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // =========================================================
    // FIND ORDER WITHOUT STATUS FILTER
    // =========================================================

    const order = await Order.findById(orderId);

    console.log("ORDER FOUND:", order);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

  
    // =========================================================
    // CHECK ORDER USER
    // =========================================================

    if (String(order.user) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "This order does not belong to the logged-in user",
      });
    }

    // =========================================================
    // CHECK ORDER STATUS
    // =========================================================

    if (order.orderStatus !== "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "You can review only delivered orders",
        currentStatus: order.orderStatus,
      });
    }

    // =========================================================
    // CHECK DELETED
    // =========================================================

    if (order.isDeleted === true) {
      return res.status(400).json({
        success: false,
        message: "This order has been deleted",
      });
    }

    // =========================================================
    // CHECK ORDER ITEM
    // =========================================================

    const orderItem = await OrderItem.findOne({
      _id: orderItemId,
      order: orderId,
      product: productId,
    });

    console.log("ORDER ITEM:", orderItem);

    if (!orderItem) {
      return res.status(400).json({
        success: false,
        message: "Product was not found in this order",
      });
    }

    // =========================================================
    // CHECK ALREADY REVIEWED
    // =========================================================

    if (orderItem.isReviewed === true) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    // =========================================================
    // CHECK EXISTING REVIEW
    // =========================================================

    const existingReview = await Review.findOne({
      user: userId,
      orderItem: orderItemId,
      isDeleted: { $ne: true },
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "Review already exists",
      });
    }

    // =========================================================
    // CREATE REVIEW
    // =========================================================

    const review = await Review.create({
      user: userId,
      product: productId,
      order: orderId,
      orderItem: orderItemId,
      rating,
      title,
      comment,
      images,
      status: "PENDING",
    });

    // =========================================================
    // UPDATE ORDER ITEM
    // =========================================================

    orderItem.isReviewed = true;
    await orderItem.save();

    // =========================================================
    // RESPONSE
    // =========================================================

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: review,
    });

  } catch (error) {
    console.error("CREATE REVIEW ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create review",
      error: error.message,
    });
  }
};

// =============================================================
// GET PRODUCT REVIEWS
// GET /api/reviews/product/:productId
// =============================================================

exports.getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      product: req.params.productId,
      status: "APPROVED",
      isDeleted: false,
    })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    const ratingSummary = await Review.aggregate([
      {
        $match: {
          product: new (require("mongoose").Types.ObjectId)(
            req.params.productId
          ),
          status: "APPROVED",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: {
            $avg: "$rating",
          },
          totalReviews: {
            $sum: 1,
          },
        },
      },
    ]);

    return res.json({
      success: true,
      data: reviews,
      summary: ratingSummary[0] || {
        averageRating: 0,
        totalReviews: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: error.message,
    });
  }
};

// =============================================================
// GET ALL REVIEWS - ADMIN
// GET /api/reviews/admin/all
// =============================================================

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      isDeleted: false,
    })
      .populate("user", "name email mobileNumber")
      .populate("product", "name")
      .populate("order", "orderNumber")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: error.message,
    });
  }
};

// =============================================================
// UPDATE REVIEW STATUS - ADMIN
// PATCH /api/reviews/:id/status
// =============================================================

exports.updateReviewStatus = async (req, res) => {
  try {
    const {
      status,
      rejectionReason = "",
    } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status",
      });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        status,
        rejectionReason,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    return res.json({
      success: true,
      message: "Review status updated",
      data: review,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update review status",
      error: error.message,
    });
  }
};

// =============================================================
// DELETE REVIEW
// DELETE /api/reviews/:id
// =============================================================

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      {
        new: true,
      }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    return res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: error.message,
    });
  }
};