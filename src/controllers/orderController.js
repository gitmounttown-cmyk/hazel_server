const mongoose = require("mongoose");

const Order = require("../models/orderModel");
const OrderItem = require("../models/orderItemModel");
const Product = require("../models/productModel");
const ProductVariant = require("../models/productVariantModel");
const Address = require("../models/addressModel");
const Coupon = require("../models/couponModel");
const Notification = require("../models/notificationModel");



// ==========================================================
// GET USER ID
// ==========================================================

const getUserId = (req) => {
  return req.user?.id || req.user?._id || req.user?.userId || null;
};

// ==========================================================
// CREATE ORDER
// POST /api/orders/create
// ==========================================================

exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = getUserId(req);

    // ======================================================
    // AUTHENTICATION
    // ======================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      items,
      addressId,
      paymentMethod = "COD",
      couponCode = "",
      customerNote = "",
    } = req.body;

    // ======================================================
    // VALIDATE ITEMS
    // ======================================================

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are required",
      });
    }

    // ======================================================
    // VALIDATE ADDRESS ID
    // ======================================================

    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    // ======================================================
    // VALIDATE PAYMENT METHOD
    // ======================================================

    const allowedPaymentMethods = [
      "COD",
      "UPI",
      "CARD",
      "NET_BANKING",
      "WALLET",
    ];

    const normalizedPaymentMethod =
      String(paymentMethod).trim().toUpperCase();

    if (!allowedPaymentMethods.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
        allowedPaymentMethods,
      });
    }

    // ======================================================
    // START TRANSACTION
    // ======================================================

    session.startTransaction();

    // ======================================================
    // ADDRESS
    // ======================================================

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true,
    }).session(session);

    if (!address) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Address not found or inactive",
      });
    }

    // ======================================================
    // ADDRESS SNAPSHOT
    // ======================================================

    const addressLine1 = [
      address.houseNo,
      address.street,
    ]
      .filter(Boolean)
      .join(", ");

    const addressLine2 = [
      address.area,
      address.landmark,
    ]
      .filter(Boolean)
      .join(", ");

    const shippingAddress = {
      name: address.fullName,

      mobileNumber: address.mobileNumber,

      addressLine1,

      addressLine2,

      district: address.district || "",

      city: address.city,

      state: address.state,

      pincode: address.pincode,

      country: address.country || "India",
    };

    // ======================================================
    // VALIDATE SHIPPING ADDRESS
    // ======================================================

    if (!shippingAddress.name) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Name is missing in the selected address",
      });
    }

    if (!shippingAddress.mobileNumber) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Mobile number is missing in the selected address",
      });
    }

    if (!shippingAddress.addressLine1) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message:
          "House number / street is missing in the selected address",
      });
    }

    if (!shippingAddress.city) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "City is missing in the selected address",
      });
    }

    if (!shippingAddress.state) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "State is missing in the selected address",
      });
    }

    if (!shippingAddress.pincode) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Pincode is missing in the selected address",
      });
    }

    // ======================================================
    // PREVENT DUPLICATE VARIANTS
    // ======================================================

    const variantIds = items.map((item) => String(item.variantId));

    const uniqueVariantIds = new Set(variantIds);

    if (uniqueVariantIds.size !== variantIds.length) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message:
          "The same product variant cannot be added multiple times in one order. Update the quantity instead.",
      });
    }

    // ======================================================
    // GET PRODUCTS / VARIANTS
    // ======================================================

    let subtotal = 0;

    const orderItemsData = [];

    for (const item of items) {
      // ====================================================
      // VALIDATE ITEM
      // ====================================================

      if (!item.variantId) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "variantId is required",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(item.variantId)) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: `Invalid variant ID: ${item.variantId}`,
        });
      }

      if (
        item.quantity === undefined ||
        item.quantity === null
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "quantity is required",
        });
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            "Quantity must be a positive whole number",
        });
      }

      // ====================================================
      // GET VARIANT
      // ====================================================

      const variant = await ProductVariant.findById(
        item.variantId
      )
        .populate("size", "name")
        .populate("color", "name")
        .session(session);

      if (!variant) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message:
            `Variant ${item.variantId} not found`,
        });
      }

      // ====================================================
      // CHECK VARIANT STATUS
      // ====================================================

      if (
        variant.isActive !== undefined &&
        variant.isActive === false
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            `Variant ${item.variantId} is currently inactive`,
        });
      }

      // ====================================================
      // STOCK
      // ====================================================

      const stock = Number(variant.stock || 0);

      if (stock < quantity) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            `Insufficient stock for variant ${item.variantId}`,
          availableStock: stock,
          requestedQuantity: quantity,
        });
      }

      // ====================================================
      // PRODUCT
      // ====================================================

      const product = await Product.findById(
        variant.product
      ).session(session);

      if (!product) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message:
            `Product not found for variant ${item.variantId}`,
        });
      }

      // ====================================================
      // PRODUCT STATUS
      // ====================================================

      if (
        product.isActive !== undefined &&
        product.isActive === false
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            `Product ${product.name} is currently inactive`,
        });
      }

      // ====================================================
      // PRICE
      // ====================================================

      const sellingPrice = Number(
        variant.sellingPrice ??
          variant.price ??
          product.sellingPrice ??
          product.price ??
          0
      );

      const mrp = Number(
        variant.mrp ??
          product.mrp ??
          sellingPrice
      );

      if (sellingPrice <= 0) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            `Invalid selling price for product ${product.name}`,
        });
      }

      // ====================================================
      // TOTAL PRICE
      // ====================================================

      const totalPrice = sellingPrice * quantity;

      subtotal += totalPrice;

      // ====================================================
      // IMAGE
      // ====================================================

      let image = "";

      if (variant.image) {
        image = variant.image;
      } else if (
        Array.isArray(variant.images) &&
        variant.images.length > 0
      ) {
        image = variant.images[0];
      } else if (product.thumbnail) {
        image = product.thumbnail;
      } else if (product.image) {
        image = product.image;
      } else if (
        Array.isArray(product.images) &&
        product.images.length > 0
      ) {
        image = product.images[0];
      }

      // ====================================================
      // SIZE
      // ====================================================

      let size = "";

      if (
        variant.size &&
        typeof variant.size === "object"
      ) {
        size = variant.size.name || "";
      } else if (variant.sizeName) {
        size = variant.sizeName;
      }

      // ====================================================
      // COLOR
      // ====================================================

      let color = "";

      if (
        variant.color &&
        typeof variant.color === "object"
      ) {
        color = variant.color.name || "";
      } else if (variant.colorName) {
        color = variant.colorName;
      }

      // ====================================================
      // ORDER ITEM DATA
      // ====================================================

      orderItemsData.push({
        product: product._id,
        variant: variant._id,

        productName:
          product.name ||
          product.productName ||
          "",

        sku: variant.sku || "",

        image,

        size,

        color,

        mrp,

        sellingPrice,

        quantity,

        totalPrice,
      });
    }

    // ======================================================
    // COUPON
    // ======================================================

    let coupon = null;

    let discountAmount = 0;

    if (
      couponCode &&
      String(couponCode).trim() !== ""
    ) {
      const normalizedCouponCode =
        String(couponCode)
          .trim()
          .toUpperCase();

      coupon = await Coupon.findOne({
        code: normalizedCouponCode,
        isActive: true,
        isDeleted: false,
      }).session(session);

      if (!coupon) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Invalid coupon",
        });
      }

      // ====================================================
      // COUPON DATES
      // ====================================================

      const now = new Date();

      if (
        coupon.startDate &&
        now < coupon.startDate
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Coupon is not active yet",
        });
      }

      if (
        coupon.endDate &&
        now > coupon.endDate
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Coupon has expired",
        });
      }

      // ====================================================
      // COUPON USAGE
      // ====================================================

      if (
        coupon.usageLimit !== null &&
        coupon.usageLimit !== undefined &&
        coupon.usedCount >= coupon.usageLimit
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Coupon usage limit reached",
        });
      }

      // ====================================================
      // MINIMUM ORDER
      // ====================================================

      if (
        coupon.minimumOrderAmount !== null &&
        coupon.minimumOrderAmount !== undefined &&
        subtotal < coupon.minimumOrderAmount
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            `Minimum order amount is ₹${coupon.minimumOrderAmount}`,
        });
      }

      // ====================================================
      // MAXIMUM ORDER
      // ====================================================

      if (
        coupon.maximumOrderAmount !== null &&
        coupon.maximumOrderAmount !== undefined &&
        subtotal > coupon.maximumOrderAmount
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            `Maximum order amount is ₹${coupon.maximumOrderAmount}`,
        });
      }

      // ====================================================
      // DISCOUNT
      // ====================================================

      if (
        coupon.discountType === "PERCENTAGE"
      ) {
        discountAmount =
          (subtotal *
            Number(coupon.discountValue || 0)) /
          100;

        if (
          coupon.maxDiscountAmount !== null &&
          coupon.maxDiscountAmount !== undefined
        ) {
          discountAmount = Math.min(
            discountAmount,
            Number(coupon.maxDiscountAmount)
          );
        }
      } else if (
        coupon.discountType === "FIXED"
      ) {
        discountAmount = Number(
          coupon.discountValue || 0
        );
      }

      // Discount cannot exceed subtotal
      discountAmount = Math.min(
        discountAmount,
        subtotal
      );

      // Prevent negative values
      discountAmount = Math.max(
        discountAmount,
        0
      );
    }

    // ======================================================
    // SHIPPING
    // ======================================================

    const amountAfterDiscount =
      Math.max(
        subtotal - discountAmount,
        0
      );

    const shippingCharge =
      amountAfterDiscount >= 999
        ? 0
        : 50;

    // ======================================================
    // TAX
    // ======================================================

    const taxableAmount =
      Math.max(
        subtotal - discountAmount,
        0
      );

    // Currently zero.
    // You can integrate GST calculation later.
    const taxAmount = 0;

    // ======================================================
    // FINAL TOTAL
    // ======================================================

    const totalAmount =
      taxableAmount +
      shippingCharge +
      taxAmount;

    // ======================================================
    // CREATE ORDER
    // ======================================================

    const orderData = {
      user: userId,

      shippingAddress,

      subtotal,

      discountAmount,

      shippingCharge,

      taxAmount,

      totalAmount,

      coupon:
        coupon?._id || null,

      couponCode:
        coupon?.code || "",

      paymentMethod:
        normalizedPaymentMethod,

      paymentStatus: "PENDING",

      orderStatus: "PENDING",

      customerNote:
        String(customerNote || "").trim(),
    };

    const createdOrders =
      await Order.create(
        [orderData],
        { session }
      );

    const order = createdOrders[0];

    // ======================================================
    // CREATE ORDER ITEMS + REDUCE STOCK
    // ======================================================

    const createdItems = [];

    for (
      const item of orderItemsData
    ) {
      // ====================================================
      // CREATE ORDER ITEM
      // ====================================================

      const createdOrderItems =
        await OrderItem.create(
          [
            {
              ...item,
              order: order._id,
            },
          ],
          { session }
        );

      const orderItem =
        createdOrderItems[0];

      createdItems.push(
        orderItem._id
      );

      // ====================================================
      // REDUCE STOCK SAFELY
      // ====================================================

      const updatedVariant =
        await ProductVariant.findOneAndUpdate(
          {
            _id: item.variant,
            stock: {
              $gte: item.quantity,
            },
          },
          {
            $inc: {
              stock: -item.quantity,
            },
          },
          {
            new: true,
            session,
          }
        );

      if (!updatedVariant) {
        throw new Error(
          `Stock changed while placing the order for variant ${item.variant}. Please try again.`
        );
      }
    }

    // ======================================================
    // ATTACH ITEMS TO ORDER
    // ======================================================

    order.items = createdItems;

    await order.save({
      session,
    });

    // ======================================================
    // UPDATE COUPON USAGE
    // ======================================================

    if (coupon) {
      const couponUpdate =
        await Coupon.findOneAndUpdate(
          {
            _id: coupon._id,

            // Prevent usage exceeding the limit
            $or: [
              {
                usageLimit: null,
              },
              {
                usageLimit: {
                  $exists: false,
                },
              },
              {
                $expr: {
                  $lt: [
                    "$usedCount",
                    "$usageLimit",
                  ],
                },
              },
            ],
          },
          {
            $inc: {
              usedCount: 1,
            },
          },
          {
            new: true,
            session,
          }
        );

      if (!couponUpdate) {
        throw new Error(
          "Coupon usage limit was reached. Please try again."
        );
      }
    }

    // ======================================================
    // COMMIT TRANSACTION
    // ======================================================

    await session.commitTransaction();

    // ======================================================
    // NOTIFICATION
    // ======================================================

    try {
      await Notification.create({
        user: userId,

        title: "Order placed",

        message:
          `Your order ${order.orderNumber} has been placed successfully.`,

        type: "ORDER",

        order: order._id,

        redirectType: "ORDER",

        redirectId: order._id,
      });
    } catch (notificationError) {
      // Notification failure should NOT make
      // an already-created order fail.
      console.error(
        "Order notification error:",
        notificationError
      );
    }

    // ======================================================
    // POPULATE ORDER
    // ======================================================

    const populatedOrder =
      await Order.findById(
        order._id
      )
        .populate({
          path: "items",
        })
        .populate(
          "coupon",
          "code discountType discountValue"
        )
        .populate(
          "user",
          "name email mobileNumber"
        );

    // ======================================================
    // SUCCESS RESPONSE
    // ======================================================

    return res.status(201).json({
      success: true,

      message:
        "Order created successfully",

      data: populatedOrder,
    });
  } catch (error) {
    // ======================================================
    // ROLLBACK TRANSACTION
    // ======================================================

    try {
      if (
        session.inTransaction()
      ) {
        await session.abortTransaction();
      }
    } catch (abortError) {
      console.error(
        "Transaction abort error:",
        abortError
      );
    }

    // ======================================================
    // ERROR LOG
    // ======================================================

    console.error(
      "createOrder:",
      error
    );

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(500).json({
      success: false,

      message:
        "Failed to create order",

      error:
        error.message,
    });
  } finally {
    // ======================================================
    // END SESSION
    // ======================================================

    await session.endSession();
  }
};

// =============================================================
// GET MY ORDERS
// GET /api/orders/my-orders
// =============================================================

exports.getMyOrders = async (req, res) => {
  try {
    const userId = getUserId(req);

    const orders = await Order.find({
      user: userId,
      isDeleted: false,
    })
      .populate("items")
      .populate("coupon", "code discountType discountValue")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("getMyOrders:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// =============================================================
// GET ORDER BY ID
// GET /api/orders/:id
// =============================================================

exports.getOrderById = async (req, res) => {
  try {
    const userId = getUserId(req);

    const query = {
      _id: req.params.id,
      isDeleted: false,
    };

    if (req.user?.role !== "admin") {
      query.user = userId;
    }

    const order = await Order.findOne(query)
      .populate("items")
      .populate("user", "name email mobileNumber")
      .populate("coupon", "code discountType discountValue");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// =============================================================
// ADMIN - GET ALL ORDERS
// GET /api/orders/admin/all
// =============================================================

exports.getAllOrders = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {
      isDeleted: false,
    };

    if (status) {
      query.orderStatus = status;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (search) {
      query.orderNumber = {
        $regex: search,
        $options: "i",
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("user", "name email mobileNumber")
        .populate("items")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      Order.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// =============================================================
// UPDATE ORDER STATUS
// PATCH /api/orders/:id/status
// =============================================================

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;

    const allowedStatuses = [
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RETURN_REQUESTED",
      "RETURNED",
      "REFUND_REQUESTED",
      "REFUNDED",
    ];

    if (!allowedStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        orderStatus,
        ...(orderStatus === "DELIVERED"
          ? { deliveredAt: new Date() }
          : {}),
        ...(orderStatus === "CANCELLED"
          ? { cancelledAt: new Date() }
          : {}),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update all order items
    await OrderItem.updateMany(
      { order: order._id },
      {
        itemStatus: orderStatus,
      }
    );

    await Notification.create({
      user: order.user,
      title: "Order status updated",
      message: `Your order ${order.orderNumber} is now ${orderStatus}.`,
      type: "ORDER",
      order: order._id,
      redirectType: "ORDER",
      redirectId: order._id,
    });

    return res.json({
      success: true,
      message: "Order status updated",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

// =============================================================
// CANCEL ORDER
// PATCH /api/orders/:id/cancel
// =============================================================

exports.cancelOrder = async (req, res) => {
  try {
    const userId = getUserId(req);

    const { reason = "" } = req.body;

    const query = {
      _id: req.params.id,
      isDeleted: false,
    };

    if (req.user?.role !== "admin") {
      query.user = userId;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const nonCancelableStatuses = [
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RETURNED",
      "REFUNDED",
    ];

    if (nonCancelableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled when status is ${order.orderStatus}`,
      });
    }

    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
    order.cancellationReason = reason;

    await order.save();

    // Restore stock
    const items = await OrderItem.find({
      order: order._id,
    });

    for (const item of items) {
      await ProductVariant.findByIdAndUpdate(
        item.variant,
        {
          $inc: {
            stock: item.quantity,
          },
        }
      );

      item.itemStatus = "CANCELLED";
      item.cancellationReason = reason;

      await item.save();
    }

    return res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

// =============================================================
// UPDATE TRACKING
// PATCH /api/orders/:id/tracking
// =============================================================

exports.updateTracking = async (req, res) => {
  try {
    const {
      courierName,
      trackingNumber,
      trackingUrl,
      expectedDeliveryDate,
    } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        courierName,
        trackingNumber,
        trackingUrl,
        expectedDeliveryDate,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      message: "Tracking details updated",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update tracking",
      error: error.message,
    });
  }
};

// =============================================================
// DELETE ORDER
// DELETE /api/orders/:id
// =============================================================

exports.deleteOrder = async (req, res) => {
  try {
    const userId = getUserId(req);

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      },
      {
        new: true,
      }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message,
    });
  }
};

