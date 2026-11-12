const axios = require("axios");

/**
 * Format 10-digit mobile number with 91 prefix
 */
const formatIndianMobile = (mobile) => {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits.slice(-10) ? `91${digits.slice(-10)}` : "";
};

/**
 * Send an SMS via Nettyfish SMS gateway
 */
const sendSMS = async ({ mobileNumber, message, dltTemplateId = "" }) => {
  try {
    const formattedMobile = formatIndianMobile(mobileNumber);
    if (!formattedMobile || formattedMobile.length < 12) {
      console.log(`ℹ️ [SMS SKIPPED] Invalid mobile number: "${mobileNumber}"`);
      return { success: false, message: "Invalid mobile number" };
    }

    let apiUrl = process.env.NETTYFISH_API_URL || "http://retailsms.nettyfish.com/api/mt/SendSMS";
    if (apiUrl.includes("retailapi.nettyfish.com")) {
      apiUrl = "http://retailsms.nettyfish.com/api/mt/SendSMS";
    }

    const username = process.env.NETTYFISH_USERNAME || "MOUNTTOWN";
    const password = process.env.NETTYFISH_PASSWORD || "Welcome@2026";
    const sender = process.env.NETTYFISH_SENDER_ID || "MOUNTO";
    const peId = "1701179180290264497";

    const params = {
      user: username,
      password: password,
      senderid: sender,
      channel: "Trans",
      peid: peId,
      DCS: 0,
      flashsms: 0,
      number: formattedMobile,
      text: message,
      route: 4,
    };

    if (dltTemplateId) {
      params.dlttemplateid = dltTemplateId;
    }

    console.log(`📱 [SMS DISPATCH] To: ${formattedMobile} | Text: "${message}"`);

    const response = await axios.get(apiUrl, {
      params,
      timeout: 10000,
    });

    console.log(`📱 [SMS RESPONSE] Status: ${response.status} | Data:`, JSON.stringify(response.data));
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      "⚠️ [SMS GATEWAY ERROR]:",
      error.response?.data || error.message
    );
    return { success: false, error: error.message };
  }
};

/**
 * Send customer order confirmation & invoice notification via SMS
 */
const sendCustomerInvoiceSMS = async (order, customerMobile, invoiceUrl) => {
  const name = order.shippingAddress?.name || "Customer";
  const orderNum = order.orderNumber || order._id;
  const amount = Number(order.totalAmount || 0).toLocaleString("en-IN");
  const dltTemplateId = process.env.NETTYFISH_INVOICE_DLT_ID || "";

  const message = `Dear ${name}, your payment for Hazel order #${orderNum} for Rs.${amount} is confirmed! View/download your invoice: ${invoiceUrl}. Thank you for shopping with Hazel!`;

  return sendSMS({
    mobileNumber: customerMobile,
    message,
    dltTemplateId,
  });
};

/**
 * Send admin alert SMS for completed payment
 */
const sendAdminInvoiceSMS = async (order, adminMobile, invoiceUrl) => {
  const orderNum = order.orderNumber || order._id;
  const amount = Number(order.totalAmount || 0).toLocaleString("en-IN");
  const customerName = order.shippingAddress?.name || "Customer";
  const customerPhone = order.shippingAddress?.mobileNumber || "-";
  const dltTemplateId = process.env.NETTYFISH_ADMIN_ALERT_DLT_ID || process.env.NETTYFISH_INVOICE_DLT_ID || "";

  const targetMobile = adminMobile || process.env.ADMIN_MOBILE || "8667301625,9629339144";
  const mobiles = String(targetMobile)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const message = `Hazel Admin Alert: Payment of Rs.${amount} received for Order #${orderNum} from ${customerName} (${customerPhone}). Invoice: ${invoiceUrl}`;

  const results = [];
  for (const mob of mobiles) {
    const res = await sendSMS({
      mobileNumber: mob,
      message,
      dltTemplateId,
    });
    results.push(res);
  }

  return { success: results.some((r) => r.success), details: results };
};

module.exports = {
  formatIndianMobile,
  sendSMS,
  sendCustomerInvoiceSMS,
  sendAdminInvoiceSMS,
};
