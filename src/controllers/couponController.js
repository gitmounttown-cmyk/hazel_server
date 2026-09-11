const Coupon = require("../models/couponModel");

// =============================================================
// CREATE COUPON
// POST /api/coupons/create
// =============================================================

exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      maximumOrderAmount,
      usageLimit,
      perUserLimit,
      startDate,
      endDate,
      applicableCategories,
      applicableProducts,
    } = req.body;

    const existing = await Coupon.findOne({
      code: code.toUpperCase(),
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    if (
      discountType === "PERCENTAGE" &&
      discountValue > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100",
      });
    }

    const coupon = await Coupon.create({
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      maximumOrderAmount,
      usageLimit,
      perUserLimit,
      startDate,
      endDate,
      applicableCategories,
      applicableProducts,
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create coupon",
      error: error.message,
    });
  }
};

// =============================================================
// GET ALL COUPONS
// GET /api/coupons
// =============================================================

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({
      isDeleted: false,
    })
      .populate("applicableCategories", "name")
      .populate("applicableProducts", "name")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: coupons.length,
      data: coupons,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: error.message,
    });
  }
};

// =============================================================
// GET COUPON BY ID
// GET /api/coupons/:id
// =============================================================

exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupon",
      error: error.message,
    });
  }
};

// =============================================================
// VALIDATE COUPON
// POST /api/coupons/validate
// =============================================================

exports.validateCoupon = async (req, res) => {
  try {
    const {
      code,
      orderAmount,
    } = req.body;

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });
    }

    const now = new Date();

    if (
      now < coupon.startDate ||
      now > coupon.endDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Coupon is expired or inactive",
      });
    }

    if (
      coupon.usageLimit !== null &&
      coupon.usedCount >= coupon.usageLimit
    ) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit reached",
      });
    }

    if (orderAmount < coupon.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ₹${coupon.minimumOrderAmount}`,
      });
    }

    let discountAmount = 0;

    if (coupon.discountType === "PERCENTAGE") {
      discountAmount =
        (orderAmount * coupon.discountValue) / 100;

      if (coupon.maxDiscountAmount !== null) {
        discountAmount = Math.min(
          discountAmount,
          coupon.maxDiscountAmount
        );
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    discountAmount = Math.min(
      discountAmount,
      orderAmount
    );

    return res.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        coupon,
        discountAmount,
        finalAmount: orderAmount - discountAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
      error: error.message,
    });
  }
};

// =============================================================
// UPDATE COUPON
// PATCH /api/coupons/:id
// =============================================================

exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update coupon",
      error: error.message,
    });
  }
};

// =============================================================
// DELETE COUPON
// DELETE /api/coupons/:id
// =============================================================

exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        deletedBy:
          req.user?.id ||
          req.user?._id ||
          null,
      },
      {
        new: true,
      }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
      error: error.message,
    });
  }
};