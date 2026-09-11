const axios = require("axios");
const crypto = require("crypto");

const Payment = require("../models/paymentModel");
const Order = require("../models/orderModel");
const User = require("../models/userModel");

const {
  CASHFREE_BASE_URL,
  CASHFREE_API_VERSION,
  CASHFREE_APP_ID,
  CASHFREE_SECRET_KEY,
  CASHFREE_ENV,
} = require("../config/cashfree");

// ======================================================
// HELPERS
// ======================================================

const getUserId = (req) => {
  return req.user?.id || req.user?._id || req.user?.userId;
};

const getCashfreeHeaders = () => {
  return {
    "Content-Type": "application/json",
    "x-api-version": CASHFREE_API_VERSION || "2025-01-01",
    "x-client-id": CASHFREE_APP_ID,
    "x-client-secret": CASHFREE_SECRET_KEY,
  };
};

// ======================================================
// CREATE CASHFREE PAYMENT
// POST /api/payments/create
// ======================================================

exports.createCashfreePayment = async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;

    const userId = getUserId(req);

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const allowedPaymentMethods = [
      "COD",
      "UPI",
      "CARD",
      "NET_BANKING",
      "WALLET",
      "EMI",
      "OTHER",
    ];

    const selectedPaymentMethod = paymentMethod || "UPI";

    if (!allowedPaymentMethods.includes(selectedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method. Allowed values: ${allowedPaymentMethods.join(
          ", "
        )}`,
      });
    }

    // ------------------------------------------
    // GET USER
    // ------------------------------------------

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ------------------------------------------
    // GET ORDER
    // ------------------------------------------
    // IMPORTANT:
    // Using userId because your Payment schema uses userId.
    // If your Order schema uses "user", change userId to user.
    // ------------------------------------------

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
      isDeleted: { $ne: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ------------------------------------------
    // CHECK EXISTING SUCCESSFUL PAYMENT
    // ------------------------------------------

    const existingSuccessfulPayment = await Payment.findOne({
      orderId: order._id,
      userId,
      gateway: "CASHFREE",
      status: "SUCCESS",
      isDeleted: false,
    });

    if (existingSuccessfulPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment already completed for this order",
        data: {
          paymentId: existingSuccessfulPayment.paymentId,
          status: existingSuccessfulPayment.status,
        },
      });
    }

    // ------------------------------------------
    // ORDER AMOUNT
    // ------------------------------------------

    const amount = Number(
      order.grandTotal ??
        order.totalAmount ??
        order.finalAmount ??
        order.amount ??
        0
    );

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order amount",
      });
    }

    // ------------------------------------------
    // CUSTOMER DETAILS
    // ------------------------------------------

    const customerName =
      user.name ||
      user.fullName ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "Customer";

    const customerEmail =
      user.email ||
      user.emailAddress ||
      `customer${user._id}@example.com`;

    const customerPhone = String(
      user.phone ||
        user.mobile ||
        user.phoneNumber ||
        "9999999999"
    );

    // ------------------------------------------
    // CASHFREE ORDER ID
    // ------------------------------------------

    const gatewayOrderId =
      `HZ_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // ------------------------------------------
    // RETURN URL
    // ------------------------------------------

    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5173";

    const returnUrl =
      `${frontendUrl}/payment/success?order_id={order_id}`;

    // ------------------------------------------
    // CASHFREE REQUEST
    // ------------------------------------------

    const cashfreeRequest = {
      order_id: gatewayOrderId,

      order_amount: Number(amount.toFixed(2)),

      order_currency: "INR",

      customer_details: {
        customer_id: String(user._id),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },

      order_meta: {
        return_url: returnUrl,
      },

      order_note: `Payment for order ${order._id}`,
    };

    // ------------------------------------------
    // CREATE CASHFREE ORDER
    // ------------------------------------------

    const cashfreeResponse = await axios.post(
      `${CASHFREE_BASE_URL}/orders`,
      cashfreeRequest,
      {
        headers: getCashfreeHeaders(),
      }
    );

    const cashfreeData = cashfreeResponse.data;

    if (!cashfreeData?.payment_session_id) {
      return res.status(500).json({
        success: false,
        message: "Cashfree payment session was not created",
        data: cashfreeData,
      });
    }

    // ------------------------------------------
    // CREATE PAYMENT RECORD
    // ------------------------------------------

    const paymentId =
      `PAY_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const payment = await Payment.create({
      orderId: order._id,
      userId,

      paymentId,

      transactionId: "",

      gatewayOrderId,

      gatewayPaymentId: "",

      paymentSessionId:
        cashfreeData.payment_session_id,

      gateway: "CASHFREE",

      amount,

      currency: "INR",

      paymentMethod: selectedPaymentMethod,

      status: "PENDING",

      gatewayResponse: cashfreeData,
    });

    // ------------------------------------------
    // UPDATE ORDER
    // ------------------------------------------

    if (order.paymentStatus !== undefined) {
      // If your Order enum uses uppercase:
      // order.paymentStatus = "PENDING";

      // If your Order enum uses lowercase:
      // order.paymentStatus = "pending";

      order.paymentStatus = "PENDING";

      await order.save();
    }

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Cashfree payment created successfully",

      data: {
        paymentId: payment.paymentId,

        mongoPaymentId: payment._id,

        orderId: order._id,

        userId,

        amount,

        currency: "INR",

        paymentMethod: selectedPaymentMethod,

        gateway: "CASHFREE",

        status: payment.status,

        gatewayOrderId,

        paymentSessionId:
          cashfreeData.payment_session_id,

        cashfreeOrderStatus:
          cashfreeData.order_status || "ACTIVE",
      },
    });
  } catch (error) {
    console.error(
      "CREATE CASHFREE PAYMENT ERROR:",
      error.response?.data || error.message
    );

    return res.status(
      error.response?.status || 500
    ).json({
      success: false,
      message: "Failed to create Cashfree payment",
      error:
        error.response?.data ||
        error.message,
    });
  }
};

// ======================================================
// VERIFY CASHFREE PAYMENT
// GET /api/payments/verify/:orderId
// ======================================================

exports.verifyCashfreePayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // ------------------------------------------
    // FIND PAYMENT
    // ------------------------------------------

    const payment = await Payment.findOne({
      orderId,
      userId,
      gateway: "CASHFREE",
      isDeleted: false,
    }).sort({ createdAt: -1 });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    if (!payment.gatewayOrderId) {
      return res.status(400).json({
        success: false,
        message: "Cashfree gateway order ID not found",
      });
    }

    // ------------------------------------------
    // GET PAYMENT DETAILS FROM CASHFREE
    // ------------------------------------------

    const cashfreeResponse = await axios.get(
      `${CASHFREE_BASE_URL}/orders/${payment.gatewayOrderId}/payments`,
      {
        headers: getCashfreeHeaders(),
      }
    );

    const cashfreePayments =
      cashfreeResponse.data;

    const payments = Array.isArray(
      cashfreePayments
    )
      ? cashfreePayments
      : [];

    // ------------------------------------------
    // FIND SUCCESS PAYMENT
    // ------------------------------------------

    const successPayment = payments.find(
      (item) =>
        item.payment_status === "SUCCESS"
    );

    if (successPayment) {
      payment.status = "SUCCESS";

      payment.gatewayPaymentId =
        successPayment.cf_payment_id
          ? String(successPayment.cf_payment_id)
          : "";

      payment.transactionId =
        successPayment.cf_payment_id
          ? String(successPayment.cf_payment_id)
          : "";

      payment.paidAt =
        successPayment.payment_completion_time
          ? new Date(
              successPayment.payment_completion_time
            )
          : new Date();

      payment.gatewayResponse =
        cashfreePayments;

      payment.failureReason = "";

      await payment.save();

      // ----------------------------------------
      // UPDATE ORDER
      // ----------------------------------------

      const order = await Order.findById(
        payment.orderId
      );

      if (order) {
        if (order.paymentStatus !== undefined) {
          order.paymentStatus = "PAID";
        }

        await order.save();
      }

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",

        data: {
          paymentId: payment.paymentId,

          orderId: payment.orderId,

          gatewayOrderId:
            payment.gatewayOrderId,

          gatewayPaymentId:
            payment.gatewayPaymentId,

          transactionId:
            payment.transactionId,

          amount: payment.amount,

          currency: payment.currency,

          status: payment.status,

          paidAt: payment.paidAt,

          paymentMethod:
            payment.paymentMethod,
        },
      });
    }

    // ------------------------------------------
    // LATEST PAYMENT
    // ------------------------------------------

    const latestPayment =
      payments.length > 0
        ? payments[payments.length - 1]
        : null;

    if (latestPayment) {
      const cashfreeStatus =
        latestPayment.payment_status;

      if (cashfreeStatus === "FAILED") {
        payment.status = "FAILED";

        payment.failureReason =
          latestPayment.payment_message ||
          latestPayment.payment_error?.error_description ||
          "Payment failed";
      } else if (
        cashfreeStatus === "USER_DROPPED"
      ) {
        payment.status = "CANCELLED";

        payment.failureReason =
          latestPayment.payment_message ||
          "Payment cancelled by user";
      } else {
        payment.status = "PROCESSING";
      }

      payment.gatewayPaymentId =
        latestPayment.cf_payment_id
          ? String(latestPayment.cf_payment_id)
          : "";

      payment.transactionId =
        latestPayment.cf_payment_id
          ? String(latestPayment.cf_payment_id)
          : "";

      payment.gatewayResponse =
        cashfreePayments;

      await payment.save();
    }

    return res.status(200).json({
      success: true,

      message:
        "Payment verification completed",

      data: {
        paymentId: payment.paymentId,

        orderId: payment.orderId,

        status: payment.status,

        gatewayOrderId:
          payment.gatewayOrderId,

        paymentSessionId:
          payment.paymentSessionId,

        failureReason:
          payment.failureReason,
      },
    });
  } catch (error) {
    console.error(
      "VERIFY CASHFREE PAYMENT ERROR:",
      error.response?.data || error.message
    );

    return res.status(
      error.response?.status || 500
    ).json({
      success: false,
      message: "Failed to verify Cashfree payment",
      error:
        error.response?.data ||
        error.message,
    });
  }
};

// ======================================================
// VERIFY CASHFREE WEBHOOK SIGNATURE
// ======================================================

const verifyCashfreeWebhookSignature = (
  req
) => {
  try {
    const signature =
      req.headers["x-webhook-signature"];

    const timestamp =
      req.headers["x-webhook-timestamp"];

    if (!signature || !timestamp) {
      console.error(
        "Cashfree webhook signature/timestamp missing"
      );

      return false;
    }

    if (!req.body) {
      return false;
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : req.body;

    const signedPayload =
      timestamp + rawBody;

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.CASHFREE_WEBHOOK_SECRET
        )
        .update(signedPayload)
        .digest("base64");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error(
      "Webhook signature verification error:",
      error.message
    );

    return false;
  }
};

// ======================================================
// CASHFREE WEBHOOK
// POST /api/payments/webhook
// ======================================================

exports.cashfreeWebhook = async (
  req,
  res
) => {
  try {
    // ------------------------------------------
    // VERIFY SIGNATURE
    // ------------------------------------------

    const isValid =
      verifyCashfreeWebhookSignature(req);

    if (!isValid) {
      console.error(
        "Invalid Cashfree webhook signature"
      );

      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // ------------------------------------------
    // PARSE RAW BODY
    // ------------------------------------------

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : req.body;

    const data =
      typeof rawBody === "string"
        ? JSON.parse(rawBody)
        : rawBody;

    // ------------------------------------------
    // CASHFREE WEBHOOK DATA
    // ------------------------------------------

    const gatewayOrderId =
      data?.data?.order?.order_id;

    const gatewayPaymentId =
      data?.data?.payment?.cf_payment_id;

    const paymentStatus =
      data?.data?.payment?.payment_status;

    const paymentMessage =
      data?.data?.payment?.payment_message ||
      data?.data?.payment?.payment_error
        ?.error_description ||
      "";

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!gatewayOrderId) {
      return res.status(400).json({
        success: false,
        message:
          "Cashfree gateway order ID missing",
      });
    }

    // ------------------------------------------
    // FIND PAYMENT
    // ------------------------------------------

    const payment =
      await Payment.findOne({
        gatewayOrderId,
        gateway: "CASHFREE",
        isDeleted: false,
      });

    if (!payment) {
      console.error(
        "Payment not found for Cashfree order:",
        gatewayOrderId
      );

      // Return 200 so webhook does not keep retrying
      return res.status(200).json({
        success: true,
        message: "Payment record not found",
      });
    }

    // ------------------------------------------
    // UPDATE PAYMENT
    // ------------------------------------------

    if (gatewayPaymentId) {
      payment.gatewayPaymentId =
        String(gatewayPaymentId);

      payment.transactionId =
        String(gatewayPaymentId);
    }

    payment.gatewayResponse = data;

    // ------------------------------------------
    // SUCCESS
    // ------------------------------------------

    if (paymentStatus === "SUCCESS") {
      payment.status = "SUCCESS";

      payment.paidAt = new Date();

      payment.failureReason = "";

      await payment.save();

      // ----------------------------------------
      // UPDATE ORDER
      // ----------------------------------------

      const order = await Order.findById(
        payment.orderId
      );

      if (order) {
        if (order.paymentStatus !== undefined) {
          order.paymentStatus = "PAID";
        }

        await order.save();
      }

      return res.status(200).json({
        success: true,
        message: "Payment success webhook processed",
      });
    }

    // ------------------------------------------
    // FAILED
    // ------------------------------------------

    if (paymentStatus === "FAILED") {
      payment.status = "FAILED";

      payment.failureReason =
        paymentMessage || "Payment failed";

      await payment.save();

      return res.status(200).json({
        success: true,
        message: "Payment failed webhook processed",
      });
    }

    // ------------------------------------------
    // USER DROPPED
    // ------------------------------------------

    if (paymentStatus === "USER_DROPPED") {
      payment.status = "CANCELLED";

      payment.failureReason =
        paymentMessage ||
        "Payment cancelled by user";

      await payment.save();

      return res.status(200).json({
        success: true,
        message:
          "Payment cancellation webhook processed",
      });
    }

    // ------------------------------------------
    // PENDING
    // ------------------------------------------

    if (paymentStatus === "PENDING") {
      payment.status = "PENDING";

      await payment.save();

      return res.status(200).json({
        success: true,
        message:
          "Payment pending webhook processed",
      });
    }

    // ------------------------------------------
    // OTHER / PROCESSING
    // ------------------------------------------

    payment.status = "PROCESSING";

    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment processing webhook handled",
    });
  } catch (error) {
    console.error(
      "CASHFREE WEBHOOK ERROR:",
      error.response?.data ||
        error.message
    );

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

// ======================================================
// GET PAYMENT BY ORDER
// GET /api/payments/order/:orderId
// ======================================================

exports.getPaymentByOrder = async (
  req,
  res
) => {
  try {
    const { orderId } = req.params;

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const payment =
      await Payment.findOne({
        orderId,
        userId,
        isDeleted: false,
      })
        .populate(
          "orderId",
          "orderNumber totalAmount paymentStatus orderStatus"
        )
        .populate(
          "userId",
          "name email phone"
        )
        .sort({ createdAt: -1 });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error(
      "GET PAYMENT BY ORDER ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get payment",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL PAYMENTS
// GET /api/payments/all
// ======================================================

exports.getAllPayments = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      gateway,
      search,
    } = req.query;

    const currentPage =
      Math.max(Number(page), 1);

    const perPage =
      Math.min(
        Math.max(Number(limit), 1),
        100
      );

    const skip =
      (currentPage - 1) * perPage;

    const filter = {
      isDeleted: false,
    };

    if (status) {
      filter.status = status.toUpperCase();
    }

    if (gateway) {
      filter.gateway =
        gateway.toUpperCase();
    }

    if (search) {
      filter.$or = [
        {
          paymentId: {
            $regex: search,
            $options: "i",
          },
        },
        {
          transactionId: {
            $regex: search,
            $options: "i",
          },
        },
        {
          gatewayOrderId: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const [payments, total] =
      await Promise.all([
        Payment.find(filter)
          .populate(
            "orderId",
            "orderNumber totalAmount paymentStatus orderStatus"
          )
          .populate(
            "userId",
            "name email phone"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage),

        Payment.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,

      data: payments,

      pagination: {
        page: currentPage,
        limit: perPage,
        total,
        totalPages:
          Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error(
      "GET ALL PAYMENTS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get payments",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE PAYMENT STATUS
// PUT /api/payments/status/:paymentId
// ======================================================

exports.updatePaymentStatus = async (
  req,
  res
) => {
  try {
    const { paymentId } = req.params;

    const {
      status,
      failureReason,
    } = req.body;

    const allowedStatuses = [
      "PENDING",
      "PROCESSING",
      "SUCCESS",
      "FAILED",
      "CANCELLED",
      "REFUNDED",
      "PARTIALLY_REFUNDED",
    ];

    if (
      !status ||
      !allowedStatuses.includes(
        status.toUpperCase()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatuses.join(
          ", "
        )}`,
      });
    }

    const newStatus =
      status.toUpperCase();

    const payment =
      await Payment.findOne({
        _id: paymentId,
        isDeleted: false,
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    payment.status = newStatus;

    if (failureReason !== undefined) {
      payment.failureReason =
        failureReason;
    }

    if (newStatus === "SUCCESS") {
      payment.paidAt =
        payment.paidAt || new Date();

      payment.failureReason = "";

      const order =
        await Order.findById(
          payment.orderId
        );

      if (
        order &&
        order.paymentStatus !== undefined
      ) {
        order.paymentStatus = "PAID";

        await order.save();
      }
    }

    if (newStatus === "REFUNDED") {
      payment.refundedAt =
        payment.refundedAt || new Date();
    }

    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment status updated successfully",
      data: payment,
    });
  } catch (error) {
    console.error(
      "UPDATE PAYMENT STATUS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update payment status",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE PAYMENT - SOFT DELETE
// DELETE /api/payments/delete/:paymentId
// ======================================================

exports.deletePayment = async (
  req,
  res
) => {
  try {
    const { paymentId } = req.params;

    const payment =
      await Payment.findOne({
        _id: paymentId,
        isDeleted: false,
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    payment.isDeleted = true;
    payment.deletedAt = new Date();

    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE PAYMENT ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete payment",
      error: error.message,
    });
  }
};