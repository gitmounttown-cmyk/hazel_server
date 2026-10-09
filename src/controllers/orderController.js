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

const getUserId = (req) => {
  return req.user?.id || req.user?._id || req.user?.userId || null;
};

// =============================================================
// GET MY ORDERS
// =============================================================

exports.getMyOrders = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Retrieve ALL user orders sorted newest first
    const orders = await Order.find({
      user: userId,
      isDeleted: false,
      $or: [
        { paymentMethod: "COD" },
        { paymentStatus: "PAID" },
        {
          orderStatus: {
            $in: [
              "CONFIRMED",
              "PACKED",
              "PROCESSING",
              "SHIPPED",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
              "CANCELLED",
              "RETURNED",
            ],
          },
        },
      ],
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
      message: "Failed to fetch orders.",
      error: error.message,
    });
  }
};

// =============================================================
// GET VARIANT
// =============================================================

const getVariant = (
  product,
  variantId
) => {
  return product.variants?.find(
    (variant) =>
      variant._id.toString() ===
      variantId.toString()
  );
};

// =============================================================
// GET SIZE
// =============================================================

const getSize = (
  variant,
  sizeId
) => {
  return variant?.sizes?.find(
    (size) =>
      size._id.toString() ===
      sizeId.toString()
  );
};

// =============================================================
// GET VARIANT PRICE
// =============================================================

const getVariantPrice = (
  variant
) => {
  const mrp =
    Number(variant.price);

  const discountPrice =
    Number(
      variant.discountPrice
    );

  if (
    Number.isFinite(
      discountPrice
    ) &&
    discountPrice > 0 &&
    discountPrice < mrp
  ) {
    return {
      mrp,
      sellingPrice:
        discountPrice,
    };
  }

  if (
    Number.isFinite(mrp) &&
    mrp > 0
  ) {
    return {
      mrp,
      sellingPrice: mrp,
    };
  }

  return null;
};

// =============================================================
// CREATE COD ORDER
//
// POST /api/orders/create
//
// ONLINE PAYMENT MUST USE:
// POST /api/payment/create-order
// =============================================================

exports.createOrder = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const {
      items,
      addressId,
      paymentMethod = "COD",
      couponCode = "",
      customerNote = "",
    } = req.body;

    // =========================================================
    // ONLY COD
    // =========================================================

    const normalizedPaymentMethod =
      String(
        paymentMethod
      )
        .trim()
        .toUpperCase();

    if (
      normalizedPaymentMethod !==
      "COD"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Online payments must use /api/payment/create-order.",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Order items are required.",
      });
    }

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

    session.startTransaction();

    // =========================================================
    // ADDRESS
    // =========================================================

    const address =
      await Address.findOne({
        _id: addressId,
        user: userId,
        isActive: true,
      }).session(session);

    if (!address) {
      throw new Error(
        "Address not found or inactive."
      );
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
      mobileNumber:
        address.mobileNumber,
      addressLine1,
      addressLine2,
      district:
        address.district || "",
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country:
        address.country ||
        "India",
    };

    // =========================================================
    // PROCESS ITEMS
    // =========================================================

    let subtotal = 0;

    const orderItemsData = [];

    for (const item of items) {
      if (
        !item.product ||
        !mongoose.Types.ObjectId.isValid(
          item.product
        )
      ) {
        throw new Error(
          "Valid product ID is required."
        );
      }

      if (
        !item.variantId ||
        !mongoose.Types.ObjectId.isValid(
          item.variantId
        )
      ) {
        throw new Error(
          "Valid variantId is required."
        );
      }

      if (
        !item.sizeId ||
        !mongoose.Types.ObjectId.isValid(
          item.sizeId
        )
      ) {
        throw new Error(
          "Valid sizeId is required."
        );
      }

      const quantity =
        Number(item.quantity);

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity <= 0
      ) {
        throw new Error(
          "Quantity must be a positive integer."
        );
      }

      const product =
        await Product.findOne({
          _id: item.product,
          isDeleted: {
            $ne: true,
          },
        }).session(session);

      if (!product) {
        throw new Error(
          "Product not found."
        );
      }

      const variant =
        getVariant(
          product,
          item.variantId
        );

      if (!variant) {
        throw new Error(
          `Variant not found for ${product.name}.`
        );
      }

      if (
        variant.isActive === false ||
        product.isActive === false
      ) {
        throw new Error(
          "Product or variant is inactive."
        );
      }

      const selectedSize =
        getSize(
          variant,
          item.sizeId
        );

      if (!selectedSize) {
        throw new Error(
          `Size not found for ${product.name}.`
        );
      }

      const stock =
        Number(
          selectedSize.stockQuantity ||
            0
        );

      if (
        stock < quantity
      ) {
        throw new Error(
          `Insufficient stock for ${product.name} - ${selectedSize.size}.`
        );
      }

      const priceData =
        getVariantPrice(
          variant
        );

      if (!priceData) {
        throw new Error(
          `Invalid price for ${product.name}.`
        );
      }

      const totalPrice =
        priceData.sellingPrice *
        quantity;

      subtotal += totalPrice;

      const imageMedia =
        variant.media?.find(
          (media) =>
            media.type ===
            "image"
        );

      orderItemsData.push({
        product:
          product._id,

        variantId:
          variant._id,

        sizeId:
          selectedSize._id,

        productName:
          product.name,

        sku:
          selectedSize.sku ||
          "",

        image:
          imageMedia?.imageURL ||
          "",

        size:
          selectedSize.size ||
          "",

        color:
          String(
            variant.color ||
              ""
          ).toUpperCase(),

        mrp:
          priceData.mrp,

        sellingPrice:
          priceData.sellingPrice,

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
      coupon =
        await Coupon.findOne({
          code:
            String(
              couponCode
            )
              .trim()
              .toUpperCase(),

          isActive: true,
          isDeleted: false,
        }).session(session);

      if (!coupon) {
        throw new Error(
          "Invalid coupon code."
        );
      }

      const now =
        new Date();

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
          `Minimum order amount is ₹${coupon.minimumOrderAmount}.`
        );
      }

      if (
        coupon.discountType ===
        "PERCENTAGE"
      ) {
        discountAmount =
          subtotal *
          Number(
            coupon.discountValue ||
              0
          ) /
          100;

        if (
          coupon.maxDiscountAmount
        ) {
          discountAmount =
            Math.min(
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
            coupon.discountValue ||
              0
          );
      }

      discountAmount =
        Math.max(
          0,
          Math.min(
            discountAmount,
            subtotal
          )
        );
    }

    // =========================================================
    // FINAL TOTAL
    // =========================================================

    const amountAfterDiscount =
      Math.max(
        subtotal -
          discountAmount,
        0
      );

    const shippingCharge =
      amountAfterDiscount >=
      999
        ? 0
        : 50;

    const taxAmount = 0;

    const totalAmount =
      amountAfterDiscount +
      shippingCharge +
      taxAmount;

    // =========================================================
    // CREATE ORDER
    // =========================================================

    const orderDocs =
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
              coupon?._id ||
              null,

            couponCode:
              coupon?.code ||
              "",

            paymentMethod:
              "COD",

            paymentStatus:
              "PENDING",

            orderStatus:
              "CONFIRMED",

            confirmedAt:
              new Date(),

            customerNote:
              String(
                customerNote ||
                  ""
              ).trim(),
          },
        ],
        {
          session,
        }
      );

    const order =
      orderDocs[0];

    const itemIds = [];

    // =========================================================
    // CREATE ITEMS + DEDUCT COD STOCK
    // =========================================================

    for (
      const itemData of
        orderItemsData
    ) {
      const itemDocs =
        await OrderItem.create(
          [
            {
              ...itemData,
              order:
                order._id,
              itemStatus:
                "CONFIRMED",
            },
          ],
          {
            session,
          }
        );

      itemIds.push(
        itemDocs[0]._id
      );

      const updatedProduct =
        await Product.findOneAndUpdate(
          {
            _id:
              itemData.product,

            "variants._id":
              itemData.variantId,

            "variants.sizes._id":
              itemData.sizeId,

            "variants.sizes.stockQuantity":
              {
                $gte:
                  itemData.quantity,
              },
          },
          {
            $inc: {
              "variants.$[variant].sizes.$[size].stockQuantity":
                -itemData.quantity,
            },
          },
          {
            new: true,
            session,

            arrayFilters: [
              {
                "variant._id":
                  itemData.variantId,
              },
              {
                "size._id":
                  itemData.sizeId,
              },
            ],
          }
        );

      if (!updatedProduct) {
        throw new Error(
          `Stock changed for ${itemData.productName}.`
        );
      }

      // Update variant quantity
      const variant =
        updatedProduct.variants.id(
          itemData.variantId
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

      // Update availability
      const totalStock =
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
        totalStock > 0
          ? "In Stock"
          : "Out of Stock";

      await updatedProduct.save({
        session,
      });
    }

    order.items =
      itemIds;

    await order.save({
      session,
    });

    if (coupon) {
      await Coupon.findByIdAndUpdate(
        coupon._id,
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

    await session.commitTransaction();

    // =========================================================
    // NOTIFICATION
    // =========================================================

    try {
      await Notification.create({
        user: userId,

        title:
          "Order Placed",

        message:
          `Your COD order ${order.orderNumber} has been placed successfully.`,

        type:
          "ORDER",

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

    const populatedOrder =
      await Order.findById(
        order._id
      )
        .populate("items")
        .populate(
          "coupon",
          "code discountType discountValue"
        )
        .populate(
          "user",
          "name email mobileNumber"
        );

    return res.status(201).json({
      success: true,
      message:
        "COD order created successfully.",
      data:
        populatedOrder,
    });
  } catch (error) {
    if (
      session.inTransaction()
    ) {
      await session.abortTransaction();
    }

    console.error(
      "CREATE COD ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create order.",
    });
  } finally {
    await session.endSession();
  }
};

// =============================================================
// GET USER OVERVIEW
// =============================================================

exports.getUserOverview = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const user =
      await User.findById(
        userId
      ).select(
        "name email mobileNumber isMobileVerified"
      );

    const recentOrders =
      await Order.find({
        user: userId,
        isDeleted: false,
      })
        .populate("items")
        .sort({
          createdAt: -1,
        })
        .limit(2);

    const defaultAddress =
      await Address.findOne({
        user: userId,
        isActive: true,
        isDefault: true,
      });

    const wishlist =
      await Wishlist.findOne({
        user: userId,
      }).populate({
        path: "products",
        limit: 4,
        select:
          "name variants availability",
      });

    return res.json({
      success: true,

      data: {
        userDetails:
          user,

        recentOrders,

        savedAddress:
          defaultAddress ||
          null,

        savedForLater:
          wishlist
            ? wishlist.products
            : [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch account overview.",
      error:
        error.message,
    });
  }
};

// =============================================================
// GET MY ORDERS
// =============================================================

exports.getMyOrders = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Only return COD orders or successfully PAID online orders
    const orders = await Order.find({
      user: userId,
      isDeleted: false,
      $or: [
        { paymentMethod: "COD" },
        { paymentStatus: "PAID" },
        { orderStatus: { $in: ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] } }
      ]
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
      message: "Failed to fetch orders.",
      error: error.message,
    });
  }
};

// =============================================================
// GET SINGLE ORDER
// =============================================================

exports.getOrderById = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    const query = {
      _id:
        req.params.id,
      isDeleted:
        false,
    };

    if (
      req.user?.role !==
      "admin"
    ) {
      query.user =
        userId;
    }

    const order =
      await Order.findOne(
        query
      )
        .populate("items")
        .populate(
          "user",
          "name email mobileNumber"
        )
        .populate(
          "coupon",
          "code discountType discountValue"
        )
        .populate(
          "payment"
        );

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found.",
      });
    }

    return res.json({
      success: true,
      data:
        order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch order.",
      error:
        error.message,
    });
  }
};

// =============================================================
// GET ALL ORDERS - ADMIN
// =============================================================

exports.getAllOrders = async (
  req,
  res
) => {
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
      query.orderStatus =
        status;
    }

    if (paymentStatus) {
      query.paymentStatus =
        paymentStatus;
    }

    if (search) {
      query.orderNumber = {
        $regex:
          search,
        $options: "i",
      };
    }

    const pageNumber =
      Math.max(
        1,
        Number(page)
      );

    const limitNumber =
      Math.max(
        1,
        Number(limit)
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    const [
      orders,
      total,
    ] = await Promise.all([
      Order.find(query)
        .populate(
          "user",
          "name email mobileNumber"
        )
        .populate("items")
        .populate("payment")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      Order.countDocuments(
        query
      ),
    ]);

    return res.json({
      success: true,
      data:
        orders,

      pagination: {
        total,
        page:
          pageNumber,
        limit:
          limitNumber,
        totalPages:
          Math.ceil(
            total /
              limitNumber
          ),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch orders.",
      error:
        error.message,
    });
  }
};

// =============================================================
// UPDATE ORDER STATUS - ADMIN
// =============================================================

exports.updateOrderStatus =
  async (req, res) => {
    try {
      const {
        orderStatus,
      } = req.body;

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

      if (
        !allowedStatuses.includes(
          orderStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order status.",
        });
      }

      const updates = {
        orderStatus,
      };

      if (
        orderStatus ===
        "CONFIRMED"
      ) {
        updates.confirmedAt =
          new Date();
      }

      if (
        orderStatus ===
        "PACKED"
      ) {
        updates.packedAt =
          new Date();
      }

      if (
        orderStatus ===
        "SHIPPED"
      ) {
        updates.shippedAt =
          new Date();
      }

      if (
        orderStatus ===
        "DELIVERED"
      ) {
        updates.deliveredAt =
          new Date();
      }

      if (
        orderStatus ===
        "CANCELLED"
      ) {
        updates.cancelledAt =
          new Date();
      }

      const order =
        await Order.findByIdAndUpdate(
          req.params.id,
          updates,
          {
            new: true,
            runValidators:
              true,
          }
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      await OrderItem.updateMany(
        {
          order:
            order._id,
        },
        {
          itemStatus:
            orderStatus,
        }
      );

      await Notification.create({
        user:
          order.user,

        title:
          "Order Status Updated",

        message:
          `Your order ${order.orderNumber} status is now ${orderStatus}.`,

        type:
          "ORDER",

        order:
          order._id,

        redirectType:
          "ORDER",

        redirectId:
          order._id,
      });

      return res.json({
        success: true,
        message:
          "Order status updated successfully.",
        data:
          order,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          "Failed to update order status.",
        error:
          error.message,
      });
    }
  };

// =============================================================
// UPDATE TRACKING
// =============================================================

exports.updateTracking =
  async (req, res) => {
    try {
      const {
        courierName,
        trackingNumber,
        trackingUrl,
        expectedDeliveryDate,
      } = req.body;

      const order =
        await Order.findByIdAndUpdate(
          req.params.id,
          {
            courierName,
            trackingNumber,
            trackingUrl,
            expectedDeliveryDate,
          },
          {
            new: true,
            runValidators:
              true,
          }
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      return res.json({
        success: true,
        message:
          "Tracking details updated successfully.",
        data:
          order,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          "Failed to update tracking details.",
        error:
          error.message,
      });
    }
  };

// =============================================================
// CANCEL ORDER
// =============================================================

exports.cancelOrder = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

  try {
    const userId =
      getUserId(req);

    const {
      reason = "",
    } = req.body;

    const query = {
      _id:
        req.params.id,
      isDeleted:
        false,
    };

    if (
      req.user?.role !==
      "admin"
    ) {
      query.user =
        userId;
    }

    const order =
      await Order.findOne(
        query
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found.",
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

    if (
      nonCancelableStatuses.includes(
        order.orderStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Order cannot be cancelled when status is ${order.orderStatus}.`,
      });
    }

    session.startTransaction();

    order.orderStatus =
      "CANCELLED";

    order.cancelledAt =
      new Date();

    order.cancellationReason =
      reason;

    await order.save({
      session,
    });

    const items =
      await OrderItem.find({
        order:
          order._id,
      }).session(session);

    // =========================================================
    // RESTORE STOCK ONLY IF STOCK WAS DEDUCTED
    //
    // COD = stock already deducted
    // ONLINE PAID = stock already deducted
    // ONLINE PENDING = stock NOT deducted
    // =========================================================

    const stockWasDeducted =
      order.paymentMethod ===
        "COD" ||
      order.paymentStatus ===
        "PAID";

    if (
      stockWasDeducted
    ) {
      for (
        const item of items
      ) {
        await Product.findOneAndUpdate(
          {
            _id:
              item.product,

            "variants._id":
              item.variantId,

            "variants.sizes._id":
              item.sizeId,
          },
          {
            $inc: {
              "variants.$[variant].sizes.$[size].stockQuantity":
                item.quantity,
            },
          },
          {
            session,

            arrayFilters: [
              {
                "variant._id":
                  item.variantId,
              },
              {
                "size._id":
                  item.sizeId,
              },
            ],
          }
        );

        item.itemStatus =
          "CANCELLED";

        item.cancellationReason =
          reason;

        await item.save({
          session,
        });
      }
    } else {
      await OrderItem.updateMany(
        {
          order:
            order._id,
        },
        {
          itemStatus:
            "CANCELLED",
          cancellationReason:
            reason,
        },
        {
          session,
        }
      );
    }

    await session.commitTransaction();

    return res.json({
      success: true,
      message:
        "Order cancelled successfully.",
      data:
        order,
    });
  } catch (error) {
    if (
      session.inTransaction()
    ) {
      await session.abortTransaction();
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to cancel order.",
      error:
        error.message,
    });
  } finally {
    await session.endSession();
  }
};

// =============================================================
// INVOICE
// =============================================================

exports.generateInvoice =
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const query = {
        _id:
          req.params.id,
        isDeleted:
          false,
      };

      if (
        req.user?.role !==
        "admin"
      ) {
        query.user =
          userId;
      }

      const order =
        await Order.findOne(
          query
        )
          .populate("items")
          .populate(
            "user",
            "name email mobileNumber"
          );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      const doc =
        new PDFDocument({
          margin: 50,
        });

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Invoice-${order.orderNumber}.pdf`
      );

      doc.pipe(res);

      doc
        .fontSize(20)
        .text("INVOICE", {
          align: "right",
        });

      doc
        .fontSize(10)
        .text(
          `Invoice No: INV-${order.orderNumber}`,
          {
            align:
              "right",
          }
        )
        .text(
          `Date: ${new Date(
            order.createdAt
          ).toLocaleDateString()}`,
          {
            align:
              "right",
          }
        )
        .moveDown();

      doc
        .fontSize(12)
        .text(
          "Tax Invoice / Bill of Supply",
          {
            underline:
              true,
          }
        )
        .moveDown(0.5);

      doc
        .fontSize(10)
        .text(
          `Customer Name: ${order.shippingAddress.name}`
        )
        .text(
          `Phone: ${order.shippingAddress.mobileNumber}`
        )
        .text(
          `Address: ${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`
        )
        .moveDown();

      const tableTop = 230;

      doc
        .font(
          "Helvetica-Bold"
        )
        .text(
          "Item",
          50,
          tableTop
        )
        .text(
          "Qty",
          280,
          tableTop
        )
        .text(
          "Price",
          350,
          tableTop
        )
        .text(
          "Total",
          450,
          tableTop
        );

      doc
        .moveTo(
          50,
          tableTop + 15
        )
        .lineTo(
          550,
          tableTop + 15
        )
        .stroke();

      let y =
        tableTop + 25;

      doc.font(
        "Helvetica"
      );

      order.items.forEach(
        (item) => {
          doc
            .text(
              `${item.productName} (${item.size})`,
              50,
              y,
              {
                width: 220,
              }
            )
            .text(
              `${item.quantity}`,
              280,
              y
            )
            .text(
              `INR ${item.sellingPrice}`,
              350,
              y
            )
            .text(
              `INR ${item.totalPrice}`,
              450,
              y
            );

          y += 20;
        }
      );

      doc
        .moveTo(
          50,
          y
        )
        .lineTo(
          550,
          y
        )
        .stroke();

      y += 15;

      doc.text(
        `Subtotal: INR ${order.subtotal}`,
        350,
        y
      );

      y += 15;

      doc.text(
        `Discount: -INR ${order.discountAmount}`,
        350,
        y
      );

      y += 15;

      doc.text(
        `Shipping: INR ${order.shippingCharge}`,
        350,
        y
      );

      y += 15;

      doc
        .font(
          "Helvetica-Bold"
        )
        .text(
          `Total Amount: INR ${order.totalAmount}`,
          350,
          y
        );

      doc
        .font(
          "Helvetica-Oblique"
        )
        .fontSize(10)
        .text(
          "Thank you for your business!",
          50,
          700,
          {
            align:
              "center",
          }
        );

      doc.end();
    } catch (error) {
      console.error(
        "Invoice Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate invoice.",
        error:
          error.message,
      });
    }
  };

// =============================================================
// DELETE ORDER
// =============================================================

exports.deleteOrder =
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const order =
        await Order.findByIdAndUpdate(
          req.params.id,
          {
            isDeleted:
              true,
            deletedAt:
              new Date(),
            deletedBy:
              userId,
          },
          {
            new: true,
          }
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      return res.json({
        success: true,
        message:
          "Order deleted successfully.",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          "Failed to delete order.",
        error:
          error.message,
      });
    }
  };