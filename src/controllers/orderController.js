const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

const Order = require("../models/orderModel");
const OrderItem = require("../models/orderItemModel");
const Product = require("../models/productModel");
const Address = require("../models/addressModel");
const Coupon = require("../models/couponModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const Wishlist = require("../models/wishlistModel");

// ==========================================================
// HELPER: GET USER ID FROM AUTH MIDDLEWARE
// ==========================================================
const getUserId = (req) => {
  return req.user?.id || req.user?._id || req.user?.userId || null;
};

// ==========================================================
// CREATE ORDER (HANDLES EMBEDDED VARIANTS & SIZES)
// POST /api/orders/create
// ==========================================================
exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = getUserId(req);

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

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are required",
      });
    }

    if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Address ID is required",
      });
    }

    const allowedPaymentMethods = ["COD", "UPI", "CARD", "NET_BANKING", "WALLET"];
    const normalizedPaymentMethod = String(paymentMethod).trim().toUpperCase();

    if (!allowedPaymentMethods.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
        allowedPaymentMethods,
      });
    }

    session.startTransaction();

    // 1. Fetch Shipping Address
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

    const addressLine1 = [address.houseNo, address.street].filter(Boolean).join(", ");
    const addressLine2 = [address.area, address.landmark].filter(Boolean).join(", ");

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

    if (
      !shippingAddress.name ||
      !shippingAddress.mobileNumber ||
      !shippingAddress.addressLine1 ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.pincode
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Required fields are missing in the selected address",
      });
    }

    let subtotal = 0;
    const orderItemsData = [];

    // 2. Process Items & Validate Subdocument Variants/Sizes
    for (const item of items) {
      if (!item.variantId || !mongoose.Types.ObjectId.isValid(item.variantId)) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Valid variantId is required" });
      }

      if (!item.sizeId || !mongoose.Types.ObjectId.isValid(item.sizeId)) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Valid sizeId is required" });
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Quantity must be a positive integer" });
      }

      // Query Product containing the specific variant subdocument
      const product = await Product.findOne({
        "variants._id": item.variantId,
        isDeleted: { $ne: true },
      }).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product with variant ID ${item.variantId} not found`,
        });
      }

      // Find subdocument instances
      const variant = product.variants.id(item.variantId);
      if (!variant) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Variant ${item.variantId} not found`,
        });
      }

      if (variant.isActive === false || product.isActive === false) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Product or variant is inactive`,
        });
      }

      const selectedSize = variant.sizes?.id(item.sizeId);
      if (!selectedSize) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Size ${item.sizeId} not found in variant`,
        });
      }

      const stock = Number(selectedSize.stockQuantity || 0);

      if (stock < quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name} - ${selectedSize.size}`,
          availableStock: stock,
          requestedQuantity: quantity,
        });
      }

      const sellingPrice = Number(
        variant.sellingPrice ?? variant.price ?? product.sellingPrice ?? product.price ?? 0
      );
      const mrp = Number(variant.mrp ?? product.mrp ?? sellingPrice);

      if (sellingPrice <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Invalid selling price for ${product.name}`,
        });
      }

      const totalPrice = sellingPrice * quantity;
      subtotal += totalPrice;

      let image =
        variant.image ||
        (variant.images && variant.images[0]) ||
        product.thumbnail ||
        product.image ||
        (product.images && product.images[0]) ||
        "";

      let color = typeof variant.color === "object" ? variant.color.name : (variant.colorName || variant.color || "");

      orderItemsData.push({
        product: product._id,
        variantId: variant._id,
        sizeId: selectedSize._id,
        productName: product.name || product.productName || "",
        sku: variant.sku || "",
        image,
        size: selectedSize.size || "",
        color,
        mrp,
        sellingPrice,
        quantity,
        totalPrice,
      });
    }

    // 3. Handle Coupon Discounts
    let coupon = null;
    let discountAmount = 0;

    if (couponCode && String(couponCode).trim() !== "") {
      const normalizedCouponCode = String(couponCode).trim().toUpperCase();

      coupon = await Coupon.findOne({
        code: normalizedCouponCode,
        isActive: true,
        isDeleted: false,
      }).session(session);

      if (!coupon) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Invalid coupon code" });
      }

      const now = new Date();
      if (coupon.startDate && now < coupon.startDate) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Coupon is not active yet" });
      }

      if (coupon.endDate && now > coupon.endDate) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Coupon has expired" });
      }

      if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
      }

      if (coupon.minimumOrderAmount != null && subtotal < coupon.minimumOrderAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Minimum order amount for coupon is ₹${coupon.minimumOrderAmount}`,
        });
      }

      if (coupon.discountType === "PERCENTAGE") {
        discountAmount = (subtotal * Number(coupon.discountValue || 0)) / 100;
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, Number(coupon.maxDiscountAmount));
        }
      } else if (coupon.discountType === "FIXED") {
        discountAmount = Number(coupon.discountValue || 0);
      }

      discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
    }

    const amountAfterDiscount = Math.max(subtotal - discountAmount, 0);
    const shippingCharge = amountAfterDiscount >= 999 ? 0 : 50;
    const taxAmount = 0;
    const totalAmount = amountAfterDiscount + shippingCharge + taxAmount;

    // 4. Create Order Record
    const orderData = {
      user: userId,
      shippingAddress,
      subtotal,
      discountAmount,
      shippingCharge,
      taxAmount,
      totalAmount,
      coupon: coupon?._id || null,
      couponCode: coupon?.code || "",
      paymentMethod: normalizedPaymentMethod,
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      customerNote: String(customerNote || "").trim(),
    };

    const createdOrders = await Order.create([orderData], { session });
    const order = createdOrders[0];
    const createdItems = [];

    // 5. Create Order Items & Decrement Subdocument Stock
    for (const item of orderItemsData) {
      const createdOrderItems = await OrderItem.create([{ ...item, order: order._id }], { session });
      const orderItem = createdOrderItems[0];
      createdItems.push(orderItem._id);

      // Decrement stock using arrayFilters on nested subdocuments
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.product,
          "variants._id": item.variantId,
          "variants.sizes._id": item.sizeId,
          "variants.sizes.stockQuantity": { $gte: item.quantity },
        },
        {
          $inc: { "variants.$[variant].sizes.$[size].stockQuantity": -item.quantity },
        },
        {
          new: true,
          session,
          arrayFilters: [{ "variant._id": item.variantId }, { "size._id": item.sizeId }],
        }
      );

      if (!updatedProduct) {
        throw new Error(`Stock changed during order processing. Please try again.`);
      }
    }

    order.items = createdItems;
    await order.save({ session });

    if (coupon) {
      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } }, { session });
    }

    await session.commitTransaction();

    // Send Notification
    try {
      await Notification.create({
        user: userId,
        title: "Order Placed",
        message: `Your order ${order.orderNumber} has been placed successfully.`,
        type: "ORDER",
        order: order._id,
        redirectType: "ORDER",
        redirectId: order._id,
      });
    } catch (nErr) {
      console.error("Order Notification Error:", nErr);
    }

    const populatedOrder = await Order.findById(order._id)
      .populate("items")
      .populate("coupon", "code discountType discountValue")
      .populate("user", "name email mobileNumber");

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: populatedOrder,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("createOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================================
// GENERATE & DOWNLOAD INVOICE PDF
// GET /api/orders/:id/invoice
// ==========================================================
exports.generateInvoice = async (req, res) => {
  try {
    const userId = getUserId(req);

    const query = { _id: req.params.id, isDeleted: false };
    if (req.user?.role !== "admin") {
      query.user = userId;
    }

    const order = await Order.findOne(query)
      .populate("items")
      .populate("user", "name email mobileNumber");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice-${order.orderNumber}.pdf`
    );

    doc.pipe(res);

    // --- HEADER ---
    doc
      .fontSize(20)
      .text("INVOICE", { align: "right" })
      .fontSize(10)
      .text(`Invoice No: INV-${order.orderNumber}`, { align: "right" })
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: "right" })
      .moveDown();

    // --- CUSTOMER DETAILS ---
    doc
      .fontSize(12)
      .text("Tax Invoice / Bill of Supply", { underline: true })
      .moveDown(0.5)
      .fontSize(10)
      .text(`Customer Name: ${order.shippingAddress.name}`)
      .text(`Phone: ${order.shippingAddress.mobileNumber}`)
      .text(
        `Address: ${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`
      )
      .moveDown();

    // --- TABLE HEADERS ---
    const tableTop = 230;
    doc
      .font("Helvetica-Bold")
      .text("Item", 50, tableTop)
      .text("Qty", 280, tableTop)
      .text("Price", 350, tableTop)
      .text("Total", 450, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // --- TABLE ROWS ---
    let y = tableTop + 25;
    doc.font("Helvetica");

    order.items.forEach((item) => {
      doc
        .text(`${item.productName} (${item.size})`, 50, y, { width: 220 })
        .text(`${item.quantity}`, 280, y)
        .text(`INR ${item.sellingPrice}`, 350, y)
        .text(`INR ${item.totalPrice}`, 450, y);
      y += 20;
    });

    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 15;

    // --- SUMMARY ---
    doc.text(`Subtotal: INR ${order.subtotal}`, 350, y);
    y += 15;
    doc.text(`Discount: -INR ${order.discountAmount}`, 350, y);
    y += 15;
    doc.text(`Shipping: INR ${order.shippingCharge}`, 350, y);
    y += 15;
    doc
      .font("Helvetica-Bold")
      .text(`Total Amount: INR ${order.totalAmount}`, 350, y);

    // --- FOOTER ---
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .text("Thank you for your business!", 50, 700, { align: "center" });

    doc.end();
  } catch (error) {
    console.error("Invoice Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate invoice",
      error: error.message,
    });
  }
};

// ==========================================================
// CANCEL ORDER & RESTORE STOCK
// PATCH /api/orders/cancel/:id
// ==========================================================
exports.cancelOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { reason = "" } = req.body;

    const query = { _id: req.params.id, isDeleted: false };
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

    const items = await OrderItem.find({ order: order._id });

    // Restore stock to subdocuments
    for (const item of items) {
      await Product.findOneAndUpdate(
        {
          _id: item.product,
          "variants._id": item.variantId,
          "variants.sizes._id": item.sizeId,
        },
        {
          $inc: {
            "variants.$[variant].sizes.$[size].stockQuantity": item.quantity,
          },
        },
        {
          arrayFilters: [
            { "variant._id": item.variantId },
            { "size._id": item.sizeId },
          ],
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

// ==========================================================
// GET USER DASHBOARD OVERVIEW
// GET /api/orders/user-overview
// ==========================================================
exports.getUserOverview = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findById(userId).select("name email mobileNumber isMobileVerified");

    const recentOrders = await Order.find({
      user: userId,
      isDeleted: false,
    })
      .populate("items")
      .sort({ createdAt: -1 })
      .limit(2);

    const defaultAddress = await Address.findOne({
      user: userId,
      isActive: true,
      isDefault: true,
    });

    const wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: "products",
      limit: 4,
      select: "name price sellingPrice images thumbnail",
    });

    return res.json({
      success: true,
      data: {
        userDetails: user,
        recentOrders,
        savedAddress: defaultAddress || null,
        savedForLater: wishlist ? wishlist.products : [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch account overview",
      error: error.message,
    });
  }
};

// ==========================================================
// GET MY ORDERS
// GET /api/orders/my-orders
// ==========================================================
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
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// ==========================================================
// GET SINGLE ORDER BY ID
// GET /api/orders/:id
// ==========================================================
exports.getOrderById = async (req, res) => {
  try {
    const userId = getUserId(req);

    const query = { _id: req.params.id, isDeleted: false };
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

// ==========================================================
// ADMIN: GET ALL ORDERS
// GET /api/orders/admin/all
// ==========================================================
exports.getAllOrders = async (req, res) => {
  try {
    const { status, paymentStatus, search, page = 1, limit = 20 } = req.query;

    const query = { isDeleted: false };

    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) query.orderNumber = { $regex: search,$options: "i" };

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

// ==========================================================
// ADMIN: UPDATE ORDER STATUS
// PATCH /api/orders/status/:id
// ==========================================================
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;

    const allowedStatuses = [
      "PENDING",
      "CONFIRMED",
      "PACKED",
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

    const updates = { orderStatus };
    if (orderStatus === "CONFIRMED") updates.confirmedAt = new Date();
    if (orderStatus === "PACKED") updates.packedAt = new Date();
    if (orderStatus === "SHIPPED") updates.shippedAt = new Date();
    if (orderStatus === "DELIVERED") updates.deliveredAt = new Date();
    if (orderStatus === "CANCELLED") updates.cancelledAt = new Date();

    const order = await Order.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    await OrderItem.updateMany({ order: order._id }, { itemStatus: orderStatus });

    await Notification.create({
      user: order.user,
      title: "Order Status Updated",
      message: `Your order ${order.orderNumber} status is now ${orderStatus}.`,
      type: "ORDER",
      order: order._id,
      redirectType: "ORDER",
      redirectId: order._id,
    });

    return res.json({
      success: true,
      message: "Order status updated successfully",
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

// ==========================================================
// ADMIN: UPDATE TRACKING DETAILS
// PATCH /api/orders/tracking/:id
// ==========================================================
exports.updateTracking = async (req, res) => {
  try {
    const { courierName, trackingNumber, trackingUrl, expectedDeliveryDate } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { courierName, trackingNumber, trackingUrl, expectedDeliveryDate },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      message: "Tracking details updated successfully",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update tracking details",
      error: error.message,
    });
  }
};

// ==========================================================
// ADMIN: DELETE ORDER (SOFT DELETE)
// DELETE /api/orders/delete/:id
// ==========================================================
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
      { new: true }
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