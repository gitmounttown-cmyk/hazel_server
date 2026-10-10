const mongoose = require("mongoose");
const crypto = require("crypto");
const axios = require("axios");

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
const VelocityShipment = require("../models/velocityShipmentModel");

const {
  decreaseStockAfterPayment,
} = require("../services/inventoryService");

const VELOCITY_BASE_URL = process.env.VELOCITY_BASE_URL || "https://api.velocity.in";

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

// SHIPPING ALWAYS 0
const calculateShipping = () => {
  return 0;
};

const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `HZORD-${timestamp}-${random}`;
};

const generateReceipt = () => {
  return `HZRCPT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Manifest forward shipment with Velocity API
 */
const triggerVelocityManifest = async (order, shippingAddress, items, user) => {
  try {
    let token = process.env.VELOCITY_AUTH_TOKEN || "";
    if (token && !token.startsWith("Bearer ")) {
      token = `Bearer ${token}`;
    }

    let formattedItems = (items || []).map((item) => {
      const pName = item.productName || item.name || "Admire Maxi";
      const generatedSku =
        item.sku && String(item.sku).trim() !== ""
          ? String(item.sku).trim()
          : `SKU-${pName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6)}-${item.size || "STD"}`;

      return {
        name: pName,
        sku: generatedSku,
        units: Number(item.quantity || item.units || 1),
        selling_price: Number(item.sellingPrice || item.price || order.totalAmount || 1),
        discount: 0,
        tax: 0,
      };
    });

    if (formattedItems.length === 0) {
      formattedItems = [
        {
          name: "Admire Maxi",
          sku: "SKU-ADMIR-MAXI",
          units: 1,
          selling_price: Number(order.totalAmount || 1),
          discount: 0,
          tax: 0,
        },
      ];
    }

    const customerPhone = String(
      shippingAddress?.mobileNumber || user?.mobileNumber || "9999999999"
    ).replace(/\D/g, "").slice(-10);

    const customerPincode = String(
      shippingAddress?.pincode || "641301"
    ).replace(/\D/g, "");

    const payload = {
      order_id: String(order.orderNumber || order._id),
      order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
      carrier_id: "",
      warehouse_id: process.env.VELOCITY_WAREHOUSE_ID || "WHZUCD",
      pickup_location: process.env.VELOCITY_PICKUP_LOCATION || "SBS TEXTILES",
      billing_customer_name: shippingAddress?.name || user?.name || "Customer",
      billing_last_name: "",
      billing_address: shippingAddress?.addressLine1 || "Address Line 1",
      billing_city: shippingAddress?.city || "Coimbatore",
      billing_pincode: customerPincode,
      billing_state: shippingAddress?.state || "Tamil Nadu",
      billing_country: shippingAddress?.country || "India",
      billing_email: user?.email || "customer@example.com",
      billing_phone: customerPhone,
      shipping_is_billing: true,
      print_label: true,
      order_items: formattedItems,
      payment_method: "PREPAID",
      sub_total: Number(order.subtotal || order.totalAmount || 1),
      cod_collectible: 0,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    console.log("🚀 [VELOCITY MANIFEST PAYLOAD]:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${VELOCITY_BASE_URL}/custom/api/v1/forward-order-orchestration`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      }
    );

    console.log("✅ [VELOCITY MANIFEST RESPONSE]:", JSON.stringify(response.data, null, 2));

    const result = response.data;

    if (result.status === 1 && result.payload) {
      const p = result.payload;

      const shipment = await VelocityShipment.create({
        orderNumber: String(order.orderNumber || order._id),
        velocityOrderId: p.order_id,
        shipmentId: p.shipment_id,
        awbCode: p.awb_code || "",
        courierCompanyId: p.courier_company_id || "",
        courierName: p.courier_name || "",
        labelUrl: p.label_url || "",
        manifestUrl: p.manifest_url || "",
        shippingAddress: {
          name: shippingAddress?.name,
          phone: customerPhone,
          address: shippingAddress?.addressLine1,
          city: shippingAddress?.city,
          state: shippingAddress?.state,
          pincode: customerPincode,
        },
        charges: {
          shippingCharges: Number(p.charges?.frwd_charges?.shipping_charges || 0),
          codCharges: Number(p.charges?.frwd_charges?.cod_charges || 0),
          rtoCharges: Number(p.charges?.rto_charges?.rto_charges || 0),
        },
      });

      return { success: true, awbCode: p.awb_code, shipment };
    }

    console.error("❌ Velocity returned status 0:", result);
    return { success: false, data: result };
  } catch (error) {
    console.error("❌ Velocity Manifest Error:", error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

// ============================================================
// CREATE RAZORPAY ORDER
// ============================================================

exports.createOrder = async (req, res) => {
  let session;

  try {
    const userId = getUserId(req);
    const {
      addressId,
      couponCode = "",
      customerNote = "",
      amount,
      deliveryAddress,
      guestId,
    } = req.body;

    if (!userId && !guestId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login or continue as guest.",
      });
    }

    let user = null;
    if (userId) {
      user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
    }

    // ------------------------------------------------------
    // ADDRESS
    // ------------------------------------------------------

    let shippingAddr = null;

    if (userId) {
      if (deliveryAddress) {
        shippingAddr = deliveryAddress;
      } else if (addressId && isValidObjectId(addressId)) {
        const addressDoc = await Address.findOne({
          _id: addressId,
          user: userId,
          isActive: true,
        });

        if (addressDoc) {
          shippingAddr = {
            name: addressDoc.fullName || addressDoc.name || user?.name || "",
            mobileNumber: addressDoc.mobileNumber || addressDoc.phone || user?.mobileNumber || "",
            addressLine1: addressDoc.addressLine1 || addressDoc.houseNo || "",
            addressLine2: addressDoc.addressLine2 || "",
            district: addressDoc.district || "",
            city: addressDoc.city || "",
            state: addressDoc.state || "",
            pincode: addressDoc.pincode || "",
            country: addressDoc.country || "India",
          };
        }
      }
    } else {
      if (!deliveryAddress) {
        return res.status(400).json({
          success: false,
          message: "Delivery address is required.",
        });
      }

      if (
        (!deliveryAddress.fullName && !deliveryAddress.name) ||
        (!deliveryAddress.mobileNumber && !deliveryAddress.phone) ||
        !deliveryAddress.addressLine1 ||
        !deliveryAddress.city ||
        !deliveryAddress.state ||
        !deliveryAddress.pincode
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide complete delivery address.",
        });
      }

      shippingAddr = deliveryAddress;
    }

    if (!shippingAddr) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery address is required.",
      });
    }

    const cartQuery = { status: "active" };
    if (userId) {
      cartQuery.userId = userId;
    } else {
      if (!guestId || typeof guestId !== "string") {
        return res.status(400).json({
          success: false,
          message: "Valid guestId is required.",
        });
      }
      cartQuery.guestId = guestId;
    }

    const cart = await Cart.findOne(cartQuery).populate({
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
        sizeId: cartItem.sizeId || variant.sizeId || variant._id,
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
    const shippingCharge = 0;
    const taxAmount = Math.round(amountAfterDiscount * 0.09);

    // USE FRONTEND UI TOTAL IF PROVIDED, OTHERWISE FALLBACK TO BACKEND CALCULATION
    const totalAmount = amount && Number(amount) > 0 ? Number(amount) : (amountAfterDiscount + shippingCharge + taxAmount);

    if (totalAmount <= 0) {
      throw new Error("Invalid order amount.");
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const orderNumber = generateOrderNumber();

    const order = await Order.create({
      user: userId || null,
      guestId: userId ? null : guestId || null,
      orderNumber,
      items: [],
      shippingAddress: {
        name: shippingAddr.fullName || shippingAddr.name || user?.name || "Customer",
        mobileNumber: shippingAddr.mobileNumber || shippingAddr.phone || "9999999999",
        addressLine1: shippingAddr.addressLine1 || shippingAddr.houseNo || "Address Line 1",
        addressLine2: shippingAddr.addressLine2 || "",
        district: shippingAddr.district || "",
        city: shippingAddr.city || "Coimbatore",
        state: shippingAddr.state || "Tamil Nadu",
        pincode: shippingAddr.pincode || "641301",
        country: shippingAddr.country || "India",
      },
      subtotal,
      discountAmount: discountAmount,
      shippingCharge,
      taxAmount,
      totalAmount,
      coupon: appliedCoupon,
      couponCode: appliedCouponCode,
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      customerNote: customerNote || "",
    });

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
        userId: userId ? String(userId) : "",
        guestId: guestId ? String(guestId) : "",
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
          userId: userId || null,
          guestId: userId ? null : guestId,
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
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      guestId
    } = req.body;

    if (!userId && !guestId) {
      return res.status(401).json({
        success: false,
        message: "Login or a valid guest checkout session is required.",
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
      });
    }

    const paymentQuery = { razorpayOrderId: razorpay_order_id };
    if (userId) {
      paymentQuery.userId = userId;
    } else {
      paymentQuery.guestId = guestId;
    }

    const payment = await Payment.findOne(paymentQuery);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found for this checkout.",
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

    // Look up order strictly by payment's linked ecommerceOrder ID
    const order = await Order.findOne({
      _id: payment.ecommerceOrder,
    }).session(session);

    if (!order || order.isDeleted === true) {
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

    const stockResult = null;

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

    // Clear active cart
    const cartQuery = { status: "active" };
    if (userId) {
      cartQuery.userId = userId;
    } else {
      cartQuery.guestId = guestId;
    }

    await Cart.findOneAndUpdate(
      cartQuery,
      {
        $set: {
          items: [],
          totalItems: 0,
          totalAmount: 0,
          status: "ordered",
        },
      },
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();
    session = null;

    // Non-blocking Notification creation
    if (userId) {
      try {
        await Notification.create({
          user: userId,
          userId: userId,
          title: "Order Confirmed",
          message: `Your order ${order.orderNumber} has been confirmed successfully.`,
          type: "ORDER",
          order: order._id,
          orderId: order._id,
          isRead: false,
        });
      } catch (notificationError) {
        console.error("⚠️ Notification creation skipped:", notificationError.message);
      }
    }

    // NON-BLOCKING BACKGROUND VELOCITY MANIFESTATION (Immediate Redirect)
    const userLookup = userId ? User.findById(userId) : Promise.resolve(null);
    userLookup
      .then((userObj) => {
        triggerVelocityManifest(order, order.shippingAddress, orderItems, userObj)
          .then((velocityRes) => {
            if (velocityRes?.success && velocityRes?.awbCode) {
              order.trackingNumber = velocityRes.awbCode;
              order.save();
            }
          })
          .catch((vErr) => console.error("Velocity Manifestation error:", vErr.message));
      })
      .catch((userErr) => console.error("User lookup error:", userErr.message));

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

// ============================================================
// GET PAYMENT BY ORDER ID
// ============================================================

// exports.getPaymentByOrder = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const userId = getUserId(req);

//     if (!isValidObjectId(orderId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Valid order ID is required.",
//       });
//     }

//     const payment = await Payment.findOne({
//       ecommerceOrder: orderId,
//       ...(userId ? { userId } : {}),
//     });

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment details not found for this order.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       payment,
//     });
//   } catch (error) {
//     console.error("GET PAYMENT BY ORDER ERROR:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to retrieve payment details.",
//     });
//   }
// };

// ============================================================
// GET PAYMENT BY ORDER ID
// ============================================================

exports.getPaymentByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = getUserId(req);

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Valid order ID is required.",
      });
    }

    const paymentQuery = { ecommerceOrder: orderId };
    if (userId) {
      paymentQuery.userId = userId;
    }

    const payment = await Payment.findOne(paymentQuery);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment details not found for this order.",
      });
    }

    // Also fetch the associated order to get the delivery name & total amount
    const order = await Order.findById(orderId).populate("items");

    return res.status(200).json({
      success: true,
      payment,
      order: order || null,
    });
  } catch (error) {
    console.error("GET PAYMENT BY ORDER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve payment details.",
    });
  }
};