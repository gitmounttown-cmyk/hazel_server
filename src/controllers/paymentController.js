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
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    null
  );
};

// ------------------------------------------------------------
// Get Product Variant
// ------------------------------------------------------------

const getVariant = (product, variantId) => {
  if (!product || !variantId) return null;

  return (
    product.variants?.find(
      (variant) =>
        variant._id.toString() === variantId.toString()
    ) || null
  );
};

// ------------------------------------------------------------
// Get Size
// ------------------------------------------------------------

const getSize = (variant, size) => {
  if (!variant || !size) return null;

  return (
    variant.sizes?.find(
      (item) =>
        String(item.size).toUpperCase() ===
        String(size).toUpperCase()
    ) || null
  );
};

// ------------------------------------------------------------
// Get Variant Price
// ------------------------------------------------------------

const getVariantPrice = (variant) => {
  if (!variant) return null;

  const price = Number(variant.price);
  const discountPrice = Number(variant.discountPrice);

  // Discount price is valid
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

  // Normal price
  if (
    Number.isFinite(price) &&
    price > 0
  ) {
    return {
      mrp: price,
      sellingPrice: price,
    };
  }

  return null;
};

// ------------------------------------------------------------
// Get Variant Image
// ------------------------------------------------------------

const getVariantImage = (variant) => {
  return (
    variant?.media?.find(
      (media) => media.type === "image"
    )?.imageURL || ""
  );
};

// ------------------------------------------------------------
// Shipping
// ------------------------------------------------------------

const calculateShipping = (amount) => {
  return Number(amount) >= 999 ? 0 : 50;
};

// ------------------------------------------------------------
// Generate Order Number
// ------------------------------------------------------------

const generateOrderNumber = () => {
  const timestamp = Date.now();

  const random = Math.floor(
    1000 + Math.random() * 9000
  );

  return `HZORD-${timestamp}-${random}`;
};

// ------------------------------------------------------------
// Generate Razorpay Receipt
// ------------------------------------------------------------

const generateReceipt = () => {
  return `HZRCPT-${Date.now()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
};

// ------------------------------------------------------------
// Safe ObjectId Validation
// ------------------------------------------------------------

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

    const {
      addressId,
      couponCode = "",
      customerNote = "",
    } = req.body;

    // --------------------------------------------------------
    // Validate user
    // --------------------------------------------------------

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // --------------------------------------------------------
    // Validate Address
    // --------------------------------------------------------

    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "addressId is required.",
      });
    }

    if (!isValidObjectId(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid addressId.",
      });
    }

    /*
      IMPORTANT:

      If your Address model uses `userId`, change:

      user: userId

      to:

      userId: userId
    */

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

    // --------------------------------------------------------
    // Get Cart
    // --------------------------------------------------------

    const cart = await Cart.findOne({
      userId,
      status: "active",
    }).populate({
      path: "items.product",
    });

    if (!cart) {
      return res.status(400).json({
        success: false,
        message: "Cart not found.",
      });
    }

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty.",
      });
    }

    // --------------------------------------------------------
    // Validate Cart Items
    // --------------------------------------------------------

    const orderItemsData = [];

    let subtotal = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;

      if (!product) {
        throw new Error(
          "One of the products in your cart no longer exists."
        );
      }

      // ------------------------------------------------------
      // Product validation
      // ------------------------------------------------------

      if (
        product.isDeleted === true ||
        product.isActive === false
      ) {
        throw new Error(
          `Product "${product.name}" is currently unavailable.`
        );
      }

      // ------------------------------------------------------
      // Variant validation
      // ------------------------------------------------------

      const variant = getVariant(
        product,
        cartItem.variantId
      );

      if (!variant) {
        throw new Error(
          `Variant not found for product "${product.name}".`
        );
      }

      if (variant.isActive === false) {
        throw new Error(
          `Selected variant for "${product.name}" is unavailable.`
        );
      }

      // ------------------------------------------------------
      // Size validation
      // ------------------------------------------------------

      const size = getSize(
        variant,
        cartItem.size
      );

      if (!size) {
        throw new Error(
          `Size "${cartItem.size}" not found for "${product.name}".`
        );
      }

      if (size.isActive === false) {
        throw new Error(
          `Size "${cartItem.size}" is currently unavailable.`
        );
      }

      // ------------------------------------------------------
      // Quantity validation
      // ------------------------------------------------------

      const quantity = Number(cartItem.quantity);

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          `Invalid quantity for "${product.name}".`
        );
      }

      // ------------------------------------------------------
      // STOCK CHECK
      // ------------------------------------------------------

      const availableStock = Number(
        size.stockQuantity || 0
      );

      if (availableStock < quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}" - ${size.size}. Available: ${availableStock}, Requested: ${quantity}`
        );
      }

      // ------------------------------------------------------
      // Price
      // ------------------------------------------------------

      const priceInfo =
        getVariantPrice(variant);

      if (!priceInfo) {
        throw new Error(
          `Invalid price for "${product.name}".`
        );
      }

      const itemTotal =
        priceInfo.sellingPrice * quantity;

      subtotal += itemTotal;

      // ------------------------------------------------------
      // Order Item Snapshot
      // ------------------------------------------------------

      orderItemsData.push({
        product: product._id,
        variantId: variant._id,
        sizeId: size._id,

        productName: product.name,

        sku: size.sku || "",

        image: getVariantImage(variant),

        size: size.size || "",

        color: variant.color || "",

        mrp: priceInfo.mrp,

        sellingPrice:
          priceInfo.sellingPrice,

        quantity,

        totalPrice: itemTotal,
      });
    }

    // --------------------------------------------------------
    // Coupon
    // --------------------------------------------------------

    let discountAmount = 0;
    let appliedCoupon = null;
    let appliedCouponCode = "";

    if (
      couponCode &&
      String(couponCode).trim() !== ""
    ) {
      const normalizedCoupon =
        String(couponCode)
          .trim()
          .toUpperCase();

      const coupon = await Coupon.findOne({
        code: normalizedCoupon,
        isActive: true,
      });

      if (!coupon) {
        throw new Error(
          "Invalid or inactive coupon."
        );
      }

      // ------------------------------------------------------
      // Date validation
      // ------------------------------------------------------

      const now = new Date();

      if (
        coupon.startDate &&
        now < new Date(coupon.startDate)
      ) {
        throw new Error(
          "Coupon is not active yet."
        );
      }

      if (
        coupon.endDate &&
        now > new Date(coupon.endDate)
      ) {
        throw new Error(
          "Coupon has expired."
        );
      }

      // ------------------------------------------------------
      // Usage limit
      // ------------------------------------------------------

      if (
        coupon.usageLimit != null &&
        coupon.usedCount >= coupon.usageLimit
      ) {
        throw new Error(
          "Coupon usage limit has been reached."
        );
      }

      // ------------------------------------------------------
      // Minimum purchase
      // ------------------------------------------------------

      if (
        coupon.minPurchaseAmount != null &&
        subtotal <
          Number(coupon.minPurchaseAmount)
      ) {
        throw new Error(
          `Minimum purchase amount for this coupon is ₹${coupon.minPurchaseAmount}.`
        );
      }

      // ------------------------------------------------------
      // Calculate coupon
      // ------------------------------------------------------

      if (
        coupon.discountType === "percentage"
      ) {
        discountAmount =
          (subtotal *
            Number(coupon.discountValue || 0)) /
          100;

        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(
            discountAmount,
            Number(coupon.maxDiscountAmount)
          );
        }
      } else if (
        coupon.discountType === "fixed"
      ) {
        discountAmount =
          Number(coupon.discountValue || 0);
      }

      discountAmount = Math.min(
        discountAmount,
        subtotal
      );

      appliedCoupon = coupon._id;
      appliedCouponCode =
        coupon.code || normalizedCoupon;
    }

    // --------------------------------------------------------
    // Shipping
    // --------------------------------------------------------

    const amountAfterDiscount =
      Math.max(
        0,
        subtotal - discountAmount
      );

    const shippingCharge =
      calculateShipping(
        amountAfterDiscount
      );

    // --------------------------------------------------------
    // Tax
    // --------------------------------------------------------
    // Currently 0.
    // You can integrate GST later.

    const taxAmount = 0;

    // --------------------------------------------------------
    // Final Amount
    // --------------------------------------------------------

    const totalAmount =
      amountAfterDiscount +
      shippingCharge +
      taxAmount;

    if (totalAmount <= 0) {
      throw new Error(
        "Invalid order amount."
      );
    }

    // ========================================================
    // START TRANSACTION
    // ========================================================

    session = await mongoose.startSession();

    session.startTransaction();

    // --------------------------------------------------------
    // Create Order
    // --------------------------------------------------------

    const orderNumber =
      generateOrderNumber();

    const [order] =
      await Order.create(
        [
          {
            user: userId,

            orderNumber,

            items: [],

            shippingAddress: {
              name:
                address.name ||
                user.name ||
                "",

              mobileNumber:
                address.mobileNumber ||
                user.mobileNumber ||
                "",

              addressLine1:
                address.addressLine1 || "",

              addressLine2:
                address.addressLine2 || "",

              district:
                address.district || "",

              city:
                address.city || "",

              state:
                address.state || "",

              pincode:
                address.pincode || "",

              country:
                address.country ||
                "India",
            },

            subtotal,

            discountAmount,

            shippingCharge,

            taxAmount,

            totalAmount,

            coupon:
              appliedCoupon || null,

            couponCode:
              appliedCouponCode,

            paymentMethod: "ONLINE",

            paymentStatus: "PENDING",

            orderStatus: "PENDING",

            customerNote:
              customerNote || "",
          },
        ],
        { session }
      );

    // --------------------------------------------------------
    // Create Order Items
    // --------------------------------------------------------

    const orderItemsToCreate =
      orderItemsData.map((item) => ({
        ...item,
        order: order._id,
      }));

    const orderItems =
      await OrderItem.insertMany(
        orderItemsToCreate,
        { session }
      );

    // --------------------------------------------------------
    // Add Order Items to Order
    // --------------------------------------------------------

    order.items =
      orderItems.map(
        (item) => item._id
      );

    await order.save({
      session,
    });

    // --------------------------------------------------------
    // Razorpay Receipt
    // --------------------------------------------------------

    const receipt =
      generateReceipt();

    // ========================================================
    // CREATE RAZORPAY ORDER
    // ========================================================

    const razorpayOrder =
      await razorpayInstance.orders.create(
        {
          amount: Math.round(
            totalAmount * 100
          ),

          currency: "INR",

          receipt,

          notes: {
            userId:
              String(userId),

            orderId:
              String(order._id),

            orderNumber:
              order.orderNumber,
          },
        }
      );

    if (
      !razorpayOrder ||
      !razorpayOrder.id
    ) {
      throw new Error(
        "Unable to create Razorpay order."
      );
    }

    // --------------------------------------------------------
    // Update Order Razorpay ID
    // --------------------------------------------------------

    order.razorpayOrderId =
      razorpayOrder.id;

    await order.save({
      session,
    });

    // ========================================================
    // CREATE PAYMENT
    // ========================================================

    const [payment] =
      await Payment.create(
        [
          {
            userId,

            ecommerceOrder:
              order._id,

            razorpayOrderId:
              razorpayOrder.id,

            razorpayPaymentId: "",

            amount: totalAmount,

            currency: "INR",

            receipt,

            status: "created",
          },
        ],
        { session }
      );

    // --------------------------------------------------------
    // Attach Payment to Order
    // --------------------------------------------------------

    order.payment =
      payment._id;

    await order.save({
      session,
    });

    // --------------------------------------------------------
    // Commit Transaction
    // --------------------------------------------------------

    await session.commitTransaction();

    // --------------------------------------------------------
    // Close Session
    // --------------------------------------------------------

    session.endSession();
    session = null;

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,

      message:
        "Razorpay order created successfully.",

      orderId:
        order._id,

      orderNumber:
        order.orderNumber,

      razorpayOrderId:
        razorpayOrder.id,

      // This is MongoDB Payment ID
      paymentId:
        payment._id,

      amount:
        totalAmount,

      razorpayAmount:
        Math.round(
          totalAmount * 100
        ),

      currency: "INR",

      keyId:
        process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error(
      "CREATE ORDER ERROR:",
      error
    );

    // --------------------------------------------------------
    // Rollback
    // --------------------------------------------------------

    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error(
          "Abort transaction error:",
          abortError
        );
      }

      try {
        session.endSession();
      } catch (sessionError) {
        console.error(
          "Session end error:",
          sessionError
        );
      }
    }

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to create Razorpay order.",
    });
  }
};

// ============================================================
// VERIFY RAZORPAY PAYMENT
// ============================================================

exports.verifyPayment = async (
  req,
  res
) => {
  let session;

  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // --------------------------------------------------------
    // Validate Request
    // --------------------------------------------------------

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message:
          "razorpay_order_id, razorpay_payment_id and razorpay_signature are required.",
      });
    }

    // ========================================================
    // FIND PAYMENT
    // ========================================================

    const payment =
      await Payment.findOne({
        razorpayOrderId:
          razorpay_order_id,

        userId,
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment record not found.",
      });
    }

    // ========================================================
    // DUPLICATE PAYMENT PROTECTION
    // ========================================================

    if (
      payment.status === "paid"
    ) {
      const existingOrder =
        await Order.findById(
          payment.ecommerceOrder
        ).populate("items");

      return res.status(200).json({
        success: true,

        message:
          "Payment already verified.",

        order:
          existingOrder,
      });
    }

    // ========================================================
    // VERIFY RAZORPAY SIGNATURE
    // ========================================================

    const keySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.status(500).json({
        success: false,
        message:
          "Razorpay secret key is missing.",
      });
    }

    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          keySecret.trim()
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");

    // --------------------------------------------------------
    // Timing Safe Comparison
    // --------------------------------------------------------

    let signatureIsValid = false;

    try {
      const generatedBuffer =
        Buffer.from(
          generatedSignature,
          "utf8"
        );

      const receivedBuffer =
        Buffer.from(
          razorpay_signature,
          "utf8"
        );

      if (
        generatedBuffer.length ===
        receivedBuffer.length
      ) {
        signatureIsValid =
          crypto.timingSafeEqual(
            generatedBuffer,
            receivedBuffer
          );
      }
    } catch (signatureError) {
      signatureIsValid = false;
    }

    if (!signatureIsValid) {
      // Mark payment failed
      payment.status = "failed";

      await payment.save();

      return res.status(400).json({
        success: false,

        message:
          "Invalid Razorpay payment signature.",
      });
    }

    // ========================================================
    // START TRANSACTION
    // ========================================================

    session =
      await mongoose.startSession();

    session.startTransaction();

    // ========================================================
    // FIND ORDER
    // ========================================================

    const order =
      await Order.findOne({
        _id:
          payment.ecommerceOrder,

        user: userId,

        isDeleted: {
          $ne: true,
        },
      }).session(session);

    if (!order) {
      throw new Error(
        "Order not found."
      );
    }

    // --------------------------------------------------------
    // Make sure Razorpay Order ID matches
    // --------------------------------------------------------

    if (
      order.razorpayOrderId !==
      razorpay_order_id
    ) {
      throw new Error(
        "Razorpay order does not match this order."
      );
    }

    // ========================================================
    // GET ORDER ITEMS
    // ========================================================

    const orderItems =
      await OrderItem.find({
        order: order._id,
      }).session(session);

    if (
      !orderItems ||
      orderItems.length === 0
    ) {
      throw new Error(
        "No order items found."
      );
    }

    // ========================================================
    // DECREASE STOCK
    // ========================================================
    //
    // IMPORTANT:
    //
    // DO NOT perform another Product stock update here.
    //
    // decreaseStockAfterPayment()
    // updates:
    //
    // Product stock
    // +
    // Inventory stock
    // +
    // Product availability
    // +
    // Inventory totals/status
    //
    // ========================================================

    const stockResult =
      await decreaseStockAfterPayment({
        orderItems,
        session,
      });

    console.log(
      "STOCK UPDATED:",
      stockResult
    );

    // ========================================================
    // UPDATE PAYMENT
    // ========================================================

    payment.razorpayPaymentId =
      razorpay_payment_id;

    payment.signature =
      razorpay_signature;

    payment.status = "paid";

    await payment.save({
      session,
    });

    // ========================================================
    // UPDATE ORDER
    // ========================================================

    order.razorpayPaymentId =
      razorpay_payment_id;

    order.paymentStatus =
      "PAID";

    order.orderStatus =
      "CONFIRMED";

    order.confirmedAt =
      new Date();

    await order.save({
      session,
    });

    // ========================================================
    // UPDATE ORDER ITEMS
    // ========================================================

    await OrderItem.updateMany(
      {
        order: order._id,
      },
      {
        $set: {
          itemStatus:
            "CONFIRMED",
        },
      },
      {
        session,
      }
    );

    // ========================================================
    // COUPON USAGE
    // ========================================================

    if (order.coupon) {
      await Coupon.findByIdAndUpdate(
        order.coupon,
        {
          $inc: {
            usedCount: 1,
          },
        },
        {
          session,
        }
      );
    }

    // ========================================================
    // CLEAR CART
    // ========================================================
    //
    // IMPORTANT:
    //
    // Do NOT change cart status to "ordered".
    //
    // Your Cart has unique userId.
    //
    // Keep:
    //
    // status = active
    //
    // and empty the cart.
    //
    // ========================================================

    await Cart.findOneAndUpdate(
      {
        userId,

        status: "active",
      },
      {
        $set: {
          items: [],

          totalItems: 0,

          totalAmount: 0,

          status: "active",
        },
      },
      {
        session,
        new: true,
      }
    );

    // ========================================================
    // COMMIT TRANSACTION
    // ========================================================

    await session.commitTransaction();

    session.endSession();
    session = null;

    // ========================================================
    // NOTIFICATION
    // ========================================================

    try {
      await Notification.create({
        userId,

        title:
          "Order Confirmed",

        message:
          `Your order ${order.orderNumber} has been confirmed successfully.`,

        type:
          "ORDER",

        orderId:
          order._id,

        isRead: false,
      });
    } catch (notificationError) {
      // Notification failure should NOT
      // make successful payment fail.

      console.error(
        "Notification creation failed:",
        notificationError
      );
    }

    // ========================================================
    // GET UPDATED ORDER
    // ========================================================

    const updatedOrder =
      await Order.findById(
        order._id
      ).populate("items");

    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      message:
        "Payment verified successfully. Order confirmed and stock updated.",

      payment: {
        _id:
          payment._id,

        razorpayOrderId:
          payment.razorpayOrderId,

        razorpayPaymentId:
          payment.razorpayPaymentId,

        status:
          payment.status,
      },

      order:
        updatedOrder,

      stock: stockResult,
    });
  } catch (error) {
    console.error(
      "VERIFY PAYMENT ERROR:",
      error
    );

    // --------------------------------------------------------
    // Rollback transaction
    // --------------------------------------------------------

    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error(
          "Abort transaction error:",
          abortError
        );
      }

      try {
        session.endSession();
      } catch (sessionError) {
        console.error(
          "Session end error:",
          sessionError
        );
      }
    }

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Payment verification failed.",
    });
  }
};