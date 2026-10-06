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

// =============================================================
// GET USER ID
// =============================================================

const getUserId = (req) => {
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    null
  );
};

// =============================================================
// GET VARIANT
// =============================================================

const getVariant = (product, variantId) => {
  if (!product || !variantId) {
    return null;
  }

  return product.variants?.find(
    (variant) =>
      variant._id.toString() ===
      variantId.toString()
  );
};

// =============================================================
// GET SIZE
// =============================================================

const getSize = (variant, size) => {
  if (!variant || !size) {
    return null;
  }

  return variant.sizes?.find(
    (item) =>
      String(item.size).toUpperCase() ===
      String(size).toUpperCase()
  );
};

// =============================================================
// GET PRICE
// =============================================================

const getVariantPrice = (variant) => {
  if (!variant) {
    return null;
  }

  const price = Number(variant.price);
  const discountPrice = Number(
    variant.discountPrice
  );

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

// =============================================================
// GET IMAGE
// =============================================================

const getVariantImage = (variant) => {
  if (!variant) {
    return "";
  }

  const image = variant.media?.find(
    (media) => media.type === "image"
  );

  return image?.imageURL || "";
};

// =============================================================
// SHIPPING
// =============================================================

const calculateShipping = (amount) => {
  return amount >= 999 ? 0 : 50;
};

// =============================================================
// CREATE RAZORPAY ORDER
//
// POST /api/payment/create-order
// =============================================================

exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Please login before making payment.",
      });
    }

    const {
      addressId,
      couponCode = "",
      customerNote = "",
    } = req.body;

    // =========================================================
    // USER
    // =========================================================

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (!user.mobileNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Registered mobile number is required for payment.",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is inactive.",
      });
    }

    // =========================================================
    // ADDRESS
    // =========================================================

    if (
      !addressId ||
      !mongoose.Types.ObjectId.isValid(
        addressId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid Address ID is required.",
      });
    }

    const address =
      await Address.findOne({
        _id: addressId,
        user: userId,
        isActive: true,
      });

    if (!address) {
      return res.status(404).json({
        success: false,
        message:
          "Address not found or inactive.",
      });
    }

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

    // =========================================================
    // CART
    // =========================================================

    const cart =
      await Cart.findOne({
        userId,
        status: "active",
      }).populate("items.product");

    if (
      !cart ||
      !cart.items ||
      cart.items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty.",
      });
    }

    // =========================================================
    // START TRANSACTION
    // =========================================================

    session.startTransaction();

    let subtotal = 0;

    const orderItemsData = [];

    // =========================================================
    // VALIDATE CART
    // =========================================================

    for (const cartItem of cart.items) {
      const product = cartItem.product;

      if (!product) {
        throw new Error(
          "One of the products in your cart no longer exists."
        );
      }

      if (
        product.isActive === false ||
        product.isDeleted === true
      ) {
        throw new Error(
          `${product.name} is no longer available.`
        );
      }

      const variant = getVariant(
        product,
        cartItem.variantId
      );

      if (!variant) {
        throw new Error(
          `Variant not found for ${product.name}.`
        );
      }

      if (variant.isActive === false) {
        throw new Error(
          `Selected variant for ${product.name} is inactive.`
        );
      }

      const selectedSize = getSize(
        variant,
        cartItem.size
      );

      if (!selectedSize) {
        throw new Error(
          `Size ${cartItem.size} is no longer available for ${product.name}.`
        );
      }

      if (selectedSize.isActive === false) {
        throw new Error(
          `Size ${cartItem.size} is inactive.`
        );
      }

      const stockQuantity = Number(
        selectedSize.stockQuantity
      );

      const quantity = Number(
        cartItem.quantity
      );

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          `Invalid quantity for ${product.name}.`
        );
      }

      if (stockQuantity < quantity) {
        throw new Error(
          `Only ${stockQuantity} units available for ${product.name} - ${selectedSize.size}.`
        );
      }

      // =======================================================
      // PRICE FROM VARIANT
      // =======================================================

      const priceData =
        getVariantPrice(variant);

      if (!priceData) {
        throw new Error(
          `Invalid price for ${product.name}.`
        );
      }

      const {
        mrp,
        sellingPrice,
      } = priceData;

      const totalPrice =
        sellingPrice * quantity;

      subtotal += totalPrice;

      orderItemsData.push({
        product: product._id,
        variantId: variant._id,
        sizeId: selectedSize._id,
        productName: product.name,
        sku: selectedSize.sku || "",
        image: getVariantImage(variant),
        size: selectedSize.size || "",
        color: String(
          variant.color || ""
        ).toUpperCase(),
        mrp,
        sellingPrice,
        quantity,
        totalPrice,
      });
    }

    // =========================================================
    // COUPON
    // =========================================================

    let coupon = null;
    let discountAmount = 0;

    if (
      couponCode &&
      String(couponCode).trim()
    ) {
      const normalizedCouponCode =
        String(couponCode)
          .trim()
          .toUpperCase();

      coupon =
        await Coupon.findOne({
          code: normalizedCouponCode,
          isActive: true,
          isDeleted: false,
        }).session(session);

      if (!coupon) {
        throw new Error(
          "Invalid coupon code."
        );
      }

      const now = new Date();

      if (
        coupon.startDate &&
        now < coupon.startDate
      ) {
        throw new Error(
          "Coupon is not active yet."
        );
      }

      if (
        coupon.endDate &&
        now > coupon.endDate
      ) {
        throw new Error(
          "Coupon has expired."
        );
      }

      if (
        coupon.usageLimit != null &&
        coupon.usedCount >=
          coupon.usageLimit
      ) {
        throw new Error(
          "Coupon usage limit reached."
        );
      }

      if (
        coupon.minimumOrderAmount !=
          null &&
        subtotal <
          coupon.minimumOrderAmount
      ) {
        throw new Error(
          `Minimum order amount for coupon is ₹${coupon.minimumOrderAmount}.`
        );
      }

      if (
        coupon.discountType ===
        "PERCENTAGE"
      ) {
        discountAmount =
          (subtotal *
            Number(
              coupon.discountValue || 0
            )) /
          100;

        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(
            discountAmount,
            Number(
              coupon.maxDiscountAmount
            )
          );
        }
      } else if (
        coupon.discountType ===
        "FIXED"
      ) {
        discountAmount =
          Number(
            coupon.discountValue || 0
          );
      }

      discountAmount = Math.max(
        0,
        Math.min(
          discountAmount,
          subtotal
        )
      );
    }

    // =========================================================
    // FINAL AMOUNT
    // =========================================================

    const amountAfterDiscount =
      Math.max(
        subtotal - discountAmount,
        0
      );

    const shippingCharge =
      calculateShipping(
        amountAfterDiscount
      );

    const taxAmount = 0;

    const totalAmount =
      amountAfterDiscount +
      shippingCharge +
      taxAmount;

    if (
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      throw new Error(
        "Invalid order amount."
      );
    }

    // =========================================================
    // CREATE HAZEL ORDER
    //
    // IMPORTANT:
    // NO STOCK DEDUCTION HERE
    // =========================================================

    const createdOrders =
      await Order.create(
        [
          {
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
              "ONLINE",
            paymentStatus:
              "PENDING",
            orderStatus:
              "PENDING",
            customerNote:
              String(
                customerNote || ""
              ).trim(),
          },
        ],
        {
          session,
        }
      );

    const order =
      createdOrders[0];

    // =========================================================
    // CREATE ORDER ITEMS
    //
    // IMPORTANT:
    // STILL NO STOCK DEDUCTION
    // =========================================================

    const createdItemIds = [];

    for (
      const itemData of
        orderItemsData
    ) {
      const createdItems =
        await OrderItem.create(
          [
            {
              ...itemData,
              order:
                order._id,
            },
          ],
          {
            session,
          }
        );

      createdItemIds.push(
        createdItems[0]._id
      );
    }

    order.items =
      createdItemIds;

    await order.save({
      session,
    });

    // =========================================================
    // CREATE RAZORPAY ORDER
    // =========================================================

    const amountInPaise =
      Math.round(
        totalAmount * 100
      );

    const receipt =
      `HZL_${order.orderNumber}`;

    const razorpayOrder =
      await razorpayInstance.orders.create(
        {
          amount:
            amountInPaise,
          currency: "INR",
          receipt,
          notes: {
            userId:
              String(userId),
            orderId:
              String(order._id),
          },
        }
      );

    // =========================================================
    // UPDATE ORDER WITH RAZORPAY ORDER ID
    // =========================================================

    order.razorpayOrderId =
      razorpayOrder.id;

    await order.save({
      session,
    });

    // =========================================================
    // CREATE PAYMENT
    // =========================================================

    const paymentDocs =
      await Payment.create(
        [
          {
            userId,
            ecommerceOrder:
              order._id,
            razorpayOrderId:
              razorpayOrder.id,
            amount:
              totalAmount,
            currency: "INR",
            receipt,
            status:
              "created",
          },
        ],
        {
          session,
        }
      );

    const payment =
      paymentDocs[0];

    // =========================================================
    // LINK PAYMENT TO ORDER
    // =========================================================

    order.payment =
      payment._id;

    await order.save({
      session,
    });

    await session.commitTransaction();

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

      paymentId:
        payment._id,

      amount:
        totalAmount,

      razorpayAmount:
        amountInPaise,

      currency:
        "INR",

      keyId:
        process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error(
      "CREATE RAZORPAY ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create Razorpay order.",
    });
  } finally {
    await session.endSession();
  }
};

// =============================================================
// VERIFY RAZORPAY PAYMENT
//
// POST /api/payment/verify
// =============================================================

exports.verifyPayment = async (req, res) => {
  const session =
    await mongoose.startSession();

  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Please login first.",
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

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

    // =========================================================
    // FIND PAYMENT
    // =========================================================

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
          "Payment order not found.",
      });
    }

    // =========================================================
    // ALREADY PAID
    // =========================================================

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
        payment,
        order:
          existingOrder,
      });
    }

    // =========================================================
    // GENERATE SIGNATURE
    // =========================================================

    const body =
      `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(body)
        .digest("hex");

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    const receivedBuffer =
      Buffer.from(
        razorpay_signature,
        "utf8"
      );

    // =========================================================
    // SIGNATURE LENGTH CHECK
    // =========================================================

    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {
      payment.razorpayPaymentId =
        razorpay_payment_id;

      payment.signature =
        razorpay_signature;

      payment.status =
        "failed";

      await payment.save();

      return res.status(400).json({
        success: false,
        message:
          "Payment verification failed.",
        error:
          "Invalid Razorpay signature.",
      });
    }

    // =========================================================
    // SIGNATURE CHECK
    // =========================================================

    const isAuthentic =
      crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      );

    if (!isAuthentic) {
      payment.razorpayPaymentId =
        razorpay_payment_id;

      payment.signature =
        razorpay_signature;

      payment.status =
        "failed";

      await payment.save();

      return res.status(400).json({
        success: false,
        message:
          "Payment verification failed.",
        error:
          "Invalid Razorpay signature.",
      });
    }

    // =========================================================
    // START TRANSACTION
    // =========================================================

    session.startTransaction();

    // =========================================================
    // FIND ORDER
    // =========================================================

    const order =
      await Order.findOne({
        _id:
          payment.ecommerceOrder,
        user: userId,
        isDeleted: false,
      }).session(session);

    if (!order) {
      throw new Error(
        "Associated order not found."
      );
    }

    // =========================================================
    // GET ORDER ITEMS
    // =========================================================

    const orderItems =
      await OrderItem.find({
        order: order._id,
      }).session(session);

    if (
      !orderItems.length
    ) {
      throw new Error(
        "Order contains no items."
      );
    }

    // =========================================================
    // DEDUCT STOCK
    //
    // PRODUCT
    //   ↓
    // VARIANT
    //   ↓
    // SIZE
    // =========================================================

    for (
      const orderItem of
        orderItems
    ) {
      const updatedProduct =
        await Product.findOneAndUpdate(
          {
            _id:
              orderItem.product,

            "variants._id":
              orderItem.variantId,

            "variants.sizes._id":
              orderItem.sizeId,

            "variants.sizes.stockQuantity":
              {
                $gte:
                  orderItem.quantity,
              },
          },

          {
            $inc: {
              "variants.$[variant].sizes.$[size].stockQuantity":
                -orderItem.quantity,
            },
          },

          {
            new: true,
            session,

            arrayFilters: [
              {
                "variant._id":
                  orderItem.variantId,
              },

              {
                "size._id":
                  orderItem.sizeId,
              },
            ],
          }
        );

      if (!updatedProduct) {
        throw new Error(
          `Insufficient stock for ${orderItem.productName} - ${orderItem.size}.`
        );
      }

      // =======================================================
      // UPDATE VARIANT QUANTITY
      // =======================================================

      const variant =
        updatedProduct.variants.id(
          orderItem.variantId
        );

      if (variant) {
        variant.quantity =
          variant.sizes.reduce(
            (
              total,
              size
            ) =>
              total +
              Number(
                size.stockQuantity ||
                  0
              ),
            0
          );
      }

      // =======================================================
      // UPDATE PRODUCT AVAILABILITY
      // =======================================================

      const totalProductStock =
        updatedProduct.variants.reduce(
          (
            total,
            currentVariant
          ) =>
            total +
            Number(
              currentVariant.quantity ||
                0
            ),
          0
        );

      updatedProduct.availability =
        totalProductStock > 0
          ? "In Stock"
          : "Out of Stock";

      await updatedProduct.save({
        session,
      });
    }

    // =========================================================
    // PAYMENT = PAID
    // =========================================================

    payment.razorpayPaymentId =
      razorpay_payment_id;

    payment.signature =
      razorpay_signature;

    payment.status =
      "paid";

    await payment.save({
      session,
    });

    // =========================================================
    // ORDER = CONFIRMED
    // =========================================================

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

    // =========================================================
    // ORDER ITEMS = CONFIRMED
    // =========================================================

    await OrderItem.updateMany(
      {
        order:
          order._id,
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

    // =========================================================
    // COUPON USAGE
    // =========================================================

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

    // =========================================================
    // CLEAR CART
    // =========================================================

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
          status: "ordered",
        },
      },
      {
        session,
      }
    );

    // =========================================================
    // COMMIT TRANSACTION
    // =========================================================

    await session.commitTransaction();

    // =========================================================
    // NOTIFICATION
    // =========================================================

    try {
      await Notification.create({
        user: userId,
        title:
          "Payment Successful",
        message:
          `Payment successful. Your order ${order.orderNumber} has been confirmed.`,
        type: "ORDER",
        order:
          order._id,
        redirectType:
          "ORDER",
        redirectId:
          order._id,
      });
    } catch (notificationError) {
      console.error(
        "Notification Error:",
        notificationError
      );
    }

    // =========================================================
    // GET FINAL ORDER
    // =========================================================

    const populatedOrder =
      await Order.findById(
        order._id
      )
        .populate("items")
        .populate(
          "user",
          "name email mobileNumber"
        )
        .populate(
          "coupon",
          "code discountType discountValue"
        );

    return res.status(200).json({
      success: true,

      message:
        "Payment verified and order confirmed successfully.",

      payment: {
        id:
          payment._id,

        razorpayOrderId:
          payment.razorpayOrderId,

        razorpayPaymentId:
          payment.razorpayPaymentId,

        amount:
          payment.amount,

        currency:
          payment.currency,

        status:
          payment.status,
      },

      order:
        populatedOrder,
    });
  } catch (error) {
    if (
      session.inTransaction()
    ) {
      await session.abortTransaction();
    }

    console.error(
      "VERIFY PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Payment verification failed.",
    });
  } finally {
    await session.endSession();
  }
};