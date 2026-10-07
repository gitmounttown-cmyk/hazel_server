const mongoose = require("mongoose");
const crypto = require("crypto");

const razorpayInstance = require("../config/razorpay");

const Payment = require("../models/paymentModel");
const Cart = require("../models/cartModel");
const Product = require("../models/productModel");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const OrderItem = require("../models/orderItemModel");
const Address = require("../models/addressModel");
const Coupon = require("../models/couponModel");
const Notification = require("../models/notificationModel");

const {
  decreaseStockAfterPayment,
} = require("../services/inventoryService");

// ============================================================
// HELPERS
// ============================================================

const getUserId = (req) => {
  return req.user?._id || req.user?.id || req.user?.userId || null;
};

const getVariant = (product, variantId) => {
  if (!product || !variantId || !Array.isArray(product.variants)) return null;

  return (
    product.variants.find(
      (variant) => variant._id && variant._id.toString() === variantId.toString()
    ) || null
  );
};

const getVariantPrice = (variant) => {
  if (!variant) return null;

  const price = Number(variant.price);
  const discountPrice = Number(variant.discountPrice);

  if (
    Number.isFinite(discountPrice) &&
    discountPrice > 0 &&
    Number.isFinite(price) &&
    discountPrice < price
  ) {
    return {
      mrp: price,
      sellingPrice: discountPrice,
    };
  }

  if (Number.isFinite(price) && price > 0) {
    return {
      mrp: price,
      sellingPrice: price,
    };
  }

  return null;
};

const getVariantImage = (variant) => {
  if (!variant || !Array.isArray(variant.media)) return "";
  return (
    variant.media.find((media) => media.type === "image")?.imageURL || ""
  );
};

const calculateShipping = (amount) => {
  return Number(amount) >= 999 ? 0 : 50;
};

const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `HZORD-${timestamp}-${random}`;
};

const generateReceipt = () => {
  return `HZRCPT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ============================================================
// CREATE RAZORPAY ORDER
// ============================================================

exports.createOrder = async (req, res) => {
  let session;

  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { addressId, couponCode = "", customerNote = "" } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!addressId || !isValidObjectId(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Valid addressId is required.",
      });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or inactive.",
      });
    }

    const cart = await Cart.findOne({
      userId,
      status: "active",
    }).populate({
      path: "items.product",
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty.",
      });
    }

    const orderItemsData = [];
    let subtotal = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;

      if (!product) {
        throw new Error("One of the products in your cart no longer exists.");
      }

      if (product.isDeleted === true || product.isActive === false) {
        throw new Error(`Product "${product.name}" is currently unavailable.`);
      }

      const variant = getVariant(product, cartItem.variantId);

      if (!variant) {
        throw new Error(`Variant not found for product "${product.name}".`);
      }

      if (variant.isActive === false) {
        throw new Error(`Selected variant for "${product.name}" is unavailable.`);
      }

      const quantity = Number(cartItem.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for "${product.name}".`);
      }

      const priceInfo = getVariantPrice(variant);

      if (!priceInfo) {
        throw new Error(`Invalid price for "${product.name}".`);
      }

      const itemTotal = priceInfo.sellingPrice * quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        product: product._id,
        variantId: variant._id,
        productName: product.name,
        sku: variant.sku || "",
        image: getVariantImage(variant),
        mrp: priceInfo.mrp,
        sellingPrice: priceInfo.sellingPrice,
        quantity,
        totalPrice: itemTotal,
      });
    }

    // Coupon calculation
    let discountAmount = 0;
    let appliedCoupon = null;
    let appliedCouponCode = "";

    if (couponCode && String(couponCode).trim() !== "") {
      const normalizedCoupon = String(couponCode).trim().toUpperCase();

      const coupon = await Coupon.findOne({
        code: normalizedCoupon,
        isActive: true,
      });

      if (!coupon) {
        throw new Error("Invalid or inactive coupon.");
      }

      const now = new Date();

      if (coupon.startDate && now < new Date(coupon.startDate)) {
        throw new Error("Coupon is not active yet.");
      }

      if (coupon.endDate && now > new Date(coupon.endDate)) {
        throw new Error("Coupon has expired.");
      }

      if (
        coupon.usageLimit != null &&
        coupon.usedCount >= coupon.usageLimit
      ) {
        throw new Error("Coupon usage limit has been reached.");
      }

      if (
        coupon.minPurchaseAmount != null &&
        subtotal < Number(coupon.minPurchaseAmount)
      ) {
        throw new Error(
          `Minimum purchase amount for this coupon is ₹${coupon.minPurchaseAmount}.`
        );
      }

      if (coupon.discountType === "percentage") {
        discountAmount = (subtotal * Number(coupon.discountValue || 0)) / 100;
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(
            discountAmount,
            Number(coupon.maxDiscountAmount)
          );
        }
      } else if (coupon.discountType === "fixed") {
        discountAmount = Number(coupon.discountValue || 0);
      }

      discountAmount = Math.min(discountAmount, subtotal);
      appliedCoupon = coupon._id;
      appliedCouponCode = coupon.code || normalizedCoupon;
    }

    const amountAfterDiscount = Math.max(0, subtotal - discountAmount);
    const shippingCharge = calculateShipping(amountAfterDiscount);
    const taxAmount = 0;
    const totalAmount = amountAfterDiscount + shippingCharge + taxAmount;

    if (totalAmount <= 0) {
      throw new Error("Invalid order amount.");
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const orderNumber = generateOrderNumber();

    const [order] = await Order.create(
      [
        {
          user: userId,
          orderNumber,
          items: [],
          shippingAddress: {
            name: address.name || user.name || "",
            mobileNumber: address.mobileNumber || user.mobileNumber || "",
            addressLine1: address.addressLine1 || "",
            addressLine2: address.addressLine2 || "",
            district: address.district || "",
            city: address.city || "",
            state: address.state || "",
            pincode: address.pincode || "",
            country: address.country || "India",
          },
          subtotal,
          discountAmount,
          shippingCharge,
          taxAmount,
          totalAmount,
          coupon: appliedCoupon || null,
          couponCode: appliedCouponCode,
          paymentMethod: "ONLINE",
          paymentStatus: "PENDING",
          orderStatus: "PENDING",
          customerNote: customerNote || "",
        },
      ],
      { session }
    );

    const orderItemsToCreate = orderItemsData.map((item) => ({
      ...item,
      order: order._id,
    }));

    const orderItems = await OrderItem.insertMany(orderItemsToCreate, {
      session,
    });

    order.items = orderItems.map((item) => item._id);
    await order.save({ session });

    const receipt = generateReceipt();

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt,
      notes: {
        userId: String(userId),
        orderId: String(order._id),
        orderNumber: order.orderNumber,
      },
    });

    if (!razorpayOrder || !razorpayOrder.id) {
      throw new Error("Unable to create Razorpay order.");
    }

    order.razorpayOrderId = razorpayOrder.id;
    await order.save({ session });

    const [payment] = await Payment.create(
      [
        {
          userId,
          ecommerceOrder: order._id,
          razorpayOrderId: razorpayOrder.id,
          razorpayPaymentId: "",
          amount: totalAmount,
          currency: "INR",
          receipt,
          status: "created",
        },
      ],
      { session }
    );

    order.payment = payment._id;
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();
    session = null;

    return res.status(201).json({
      success: true,
      message: "Razorpay order created successfully.",
      orderId: order._id,
      orderNumber: order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      paymentId: payment._id,
      amount: totalAmount,
      razorpayAmount: Math.round(totalAmount * 100),
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Abort transaction error:", abortError);
      }
      try {
        session.endSession();
      } catch (sessionError) {
        console.error("Session end error:", sessionError);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create Razorpay order.",
    });
  }
};

// ============================================================
// VERIFY RAZORPAY PAYMENT
// ============================================================

exports.verifyPayment = async (req, res) => {
  let session;

  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message:
          "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
      });
    }

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found.",
      });
    }

    if (payment.status === "paid") {
      const existingOrder = await Order.findById(
        payment.ecommerceOrder
      ).populate("items");

      return res.status(200).json({
        success: true,
        message: "Payment already verified.",
        order: existingOrder,
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.status(500).json({
        success: false,
        message: "Razorpay secret key is missing.",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", keySecret.trim())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    let signatureIsValid = false;

    try {
      const generatedBuffer = Buffer.from(generatedSignature, "utf8");
      const receivedBuffer = Buffer.from(razorpay_signature, "utf8");

      if (generatedBuffer.length === receivedBuffer.length) {
        signatureIsValid = crypto.timingSafeEqual(
          generatedBuffer,
          receivedBuffer
        );
      }
    } catch (signatureError) {
      signatureIsValid = false;
    }

    if (!signatureIsValid) {
      payment.status = "failed";
      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay payment signature.",
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const order = await Order.findOne({
      _id: payment.ecommerceOrder,
      user: userId,
      isDeleted: { $ne: true },
    }).session(session);

    if (!order) {
      throw new Error("Order not found.");
    }

    if (order.razorpayOrderId !== razorpay_order_id) {
      throw new Error("Razorpay order does not match this order.");
    }

    const orderItems = await OrderItem.find({
      order: order._id,
    }).session(session);

    if (!orderItems || orderItems.length === 0) {
      throw new Error("No order items found.");
    }

    // Decrease stock if stock tracking service exists
    let stockResult = null;
    if (typeof decreaseStockAfterPayment === "function") {
      stockResult = await decreaseStockAfterPayment({
        orderItems,
        session,
      });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.signature = razorpay_signature;
    payment.status = "paid";
    await payment.save({ session });

    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentStatus = "PAID";
    order.orderStatus = "CONFIRMED";
    order.confirmedAt = new Date();
    await order.save({ session });

    await OrderItem.updateMany(
      { order: order._id },
      { $set: { itemStatus: "CONFIRMED" } },
      { session }
    );

    if (order.coupon) {
      await Coupon.findByIdAndUpdate(
        order.coupon,
        { $inc: { usedCount: 1 } },
        { session }
      );
    }

    // Clear cart after payment
    await Cart.findOneAndUpdate(
      { userId, status: "active" },
      {
        $set: {
          items: [],
          totalItems: 0,
          totalAmount: 0,
          status: "active",
        },
      },
      { session, new: true }
    );

    await session.commitTransaction();
    session.endSession();
    session = null;

    try {
      await Notification.create({
        userId,
        title: "Order Confirmed",
        message: `Your order ${order.orderNumber} has been confirmed successfully.`,
        type: "ORDER",
        orderId: order._id,
        isRead: false,
      });
    } catch (notificationError) {
      console.error("Notification creation failed:", notificationError);
    }

    const updatedOrder = await Order.findById(order._id).populate("items");

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully. Order confirmed.",
      payment: {
        _id: payment._id,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
        status: payment.status,
      },
      order: updatedOrder,
      stock: stockResult,
    });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);

    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Abort transaction error:", abortError);
      }
      try {
        session.endSession();
      } catch (sessionError) {
        console.error("Session end error:", sessionError);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Payment verification failed.",
    });
  }
};