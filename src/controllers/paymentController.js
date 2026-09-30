const crypto = require("crypto");
const razorpayInstance = require("../config/razorpay");
const Payment = require("../models/paymentModel");

/**
 * @desc    Create a new Razorpay Order
 * @route   POST /api/payments/create-order
 */
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", userId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required." });
    }

    const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Razorpay accepts amounts in currency sub-units (e.g., paise for INR)
    const options = {
      amount: Math.round(amount * 100),
      currency,
      receipt,
    };

    // 1. Create order on Razorpay
    const order = await razorpayInstance.orders.create(options);

    // 2. Save order details in MongoDB
    const newPayment = await Payment.create({
      userId: userId || null,
      orderId: order.id,
      amount: amount,
      currency: order.currency,
      receipt: order.receipt,
      status: "created",
    });

    res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Server error creating payment order." });
  }
};

/**
 * @desc    Verify Razorpay Payment Signature
 * @route   POST /api/payments/verify
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing required verification data." });
    }

    // 1. Generate expected HMAC-SHA256 signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    // 2. Compare signatures
    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Update payment record in database
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        {
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          status: "paid",
        }
      );

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully.",
      });
    } else {
      // Update status to failed on mismatch
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: "failed" }
      );

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature.",
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Server error verifying payment." });
  }
};