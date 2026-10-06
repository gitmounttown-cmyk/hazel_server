const crypto = require("crypto");

const razorpayInstance = require("../config/razorpay");
const Payment = require("../models/paymentModel");

// ============================================================
// CREATE RAZORPAY ORDER
// ============================================================

exports.createOrder = async (req, res) => {
  try {
    const {
      amount,
      currency = "INR",
      userId,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATE AMOUNT
    // --------------------------------------------------------

    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        success: false,
        message: "Amount is required.",
      });
    }

    const amountInRupees = Number(amount);

    if (!Number.isFinite(amountInRupees)) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid number.",
      });
    }

    if (amountInRupees <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0.",
      });
    }

    // --------------------------------------------------------
    // CONVERT RUPEES TO PAISE
    // --------------------------------------------------------
    // Example:
    //
    // ₹890
    // 890 × 100
    // = 89000 paise
    //
    // Razorpay requires amount in paise.
    // --------------------------------------------------------

    const amountInPaise = Math.round(amountInRupees * 100);

    // --------------------------------------------------------
    // GENERATE RECEIPT
    // --------------------------------------------------------

    const receipt = `rcpt_${Date.now()}_${Math.floor(
      Math.random() * 1000
    )}`;

    // --------------------------------------------------------
    // RAZORPAY ORDER OPTIONS
    // --------------------------------------------------------

    const options = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt,
    };

    console.log("=================================");
    console.log("CREATING RAZORPAY ORDER");
    console.log("=================================");
    console.log("Amount in Rupees:", amountInRupees);
    console.log("Amount in Paise:", amountInPaise);
    console.log("Currency:", options.currency);
    console.log("Receipt:", receipt);
    console.log("=================================");

    // --------------------------------------------------------
    // CREATE ORDER IN RAZORPAY
    // --------------------------------------------------------

    const order = await razorpayInstance.orders.create(options);

    console.log("Razorpay Order Created:");
    console.log(order);

    // --------------------------------------------------------
    // SAVE PAYMENT IN DATABASE
    // --------------------------------------------------------

    const payment = await Payment.create({
      userId: userId || null,

      orderId: order.id,

      amount: amountInRupees,

      currency: currency.toUpperCase(),

      receipt,

      status: "created",
    });

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,

      message: "Razorpay order created successfully.",

      paymentId: payment._id,

      orderId: order.id,

      // Customer-facing amount
      amount: amountInRupees,

      // Amount sent to Razorpay
      razorpayAmount: amountInPaise,

      currency: currency.toUpperCase(),

      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("=================================");
    console.error("ERROR CREATING RAZORPAY ORDER");
    console.error("=================================");
    console.error(error);
    console.error("=================================");

    return res.status(error.statusCode || 500).json({
      success: false,

      message:
        error?.error?.description ||
        error?.message ||
        "Failed to create Razorpay order.",

      error: error?.error?.code || null,
    });
  }
};

// ============================================================
// VERIFY RAZORPAY PAYMENT
// ============================================================

exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATE REQUEST
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

    // --------------------------------------------------------
    // CREATE SIGNATURE
    // --------------------------------------------------------

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest("hex");

    // --------------------------------------------------------
    // COMPARE SIGNATURES
    // --------------------------------------------------------

    const isAuthentic =
      expectedSignature === razorpay_signature;

    // --------------------------------------------------------
    // PAYMENT SUCCESS
    // --------------------------------------------------------

    if (isAuthentic) {
      const payment = await Payment.findOneAndUpdate(
        {
          orderId: razorpay_order_id,
        },
        {
          paymentId: razorpay_payment_id,

          signature: razorpay_signature,

          status: "paid",
        },
        {
          new: true,
        }
      );

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment record not found.",
        });
      }

      return res.status(200).json({
        success: true,

        message: "Payment verified successfully.",

        payment: {
          id: payment._id,
          orderId: payment.orderId,
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
        },
      });
    }

    // --------------------------------------------------------
    // PAYMENT FAILED
    // --------------------------------------------------------

    await Payment.findOneAndUpdate(
      {
        orderId: razorpay_order_id,
      },
      {
        paymentId: razorpay_payment_id,

        signature: razorpay_signature,

        status: "failed",
      }
    );

    return res.status(400).json({
      success: false,

      message: "Payment verification failed.",

      error: "Invalid Razorpay signature.",
    });
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Something went wrong while verifying payment.",
    });
  }
};