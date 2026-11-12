const nodemailer = require("nodemailer");

/**
 * Creates and configures the Nodemailer transporter using environment variables.
 */
const getTransporter = () => {
  const host = process.env.MAIL_HOST || "smtp.gmail.com";
  const port = Number(process.env.MAIL_PORT) || 587;
  const user = process.env.MAIL_USER || "mounttowntech@gmail.com";
  const pass = process.env.MAIL_PASS ? process.env.MAIL_PASS.replace(/\s+/g, "") : "";

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Sends order invoice email to the customer with PDF attachment.
 * @param {Object} params
 * @param {Object} params.order - Populated order object
 * @param {Buffer} params.pdfBuffer - PDF invoice buffer
 * @param {string} params.recipientEmail - Customer's email
 * @param {string} [params.customerName] - Customer's name
 */
const sendCustomerInvoiceEmail = async ({ order, pdfBuffer, recipientEmail, customerName }) => {
  if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.includes("@")) {
    console.log("ℹ️ [EMAIL SKIPPED] No valid customer email provided.");
    return { success: false, message: "No recipient email provided" };
  }

  const name = customerName || order.shippingAddress?.name || "Customer";
  const orderNum = order.orderNumber || order._id;
  const senderEmail = process.env.MAIL_USER || "mounttowntech@gmail.com";

  const mailOptions = {
    from: `"Hazel Cart" <${senderEmail}>`,
    to: recipientEmail,
    subject: `Payment Confirmed & Invoice - Order #${orderNum} | Hazel`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #222;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #D4AF37;">
          <h1 style="margin: 0; color: #111; font-size: 28px; letter-spacing: 2px;">HAZEL</h1>
          <p style="margin: 4px 0 0; color: #888; font-size: 13px;">PREMIUM FASHION & APPAREL</p>
        </div>

        <div style="padding: 24px 0;">
          <h2 style="color: #2E7D32; font-size: 20px; margin-top: 0;">Payment Confirmed!</h2>
          <p style="font-size: 15px; line-height: 1.5; color: #333;">
            Dear <strong>${name}</strong>,<br/>
            Thank you for shopping with Hazel. Your payment of <strong>Rs. ${Number(order.totalAmount || 0).toLocaleString("en-IN")}</strong> has been received and your order <strong>#${orderNum}</strong> is confirmed.
          </p>

          <div style="background-color: #F8F9FA; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #666;">Order Number:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">#${orderNum}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666;">Payment Method:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">${order.paymentMethod || "ONLINE"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666;">Payment Status:</td>
                <td style="padding: 6px 0; color: #2E7D32; font-weight: bold; text-align: right;">PAID</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666;">Total Amount:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #A37C2C; font-size: 16px;">Rs. ${Number(order.totalAmount || 0).toLocaleString("en-IN")}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; color: #444;">
            📎 <strong>Your official Tax Invoice has been generated and is attached to this email as a PDF.</strong>
          </p>

          <p style="font-size: 13px; color: #777; margin-top: 24px;">
            If you have any questions or need assistance, feel free to reply directly to this email or visit our website.
          </p>
        </div>

        <div style="border-top: 1px solid #eaeaea; padding-top: 16px; text-align: center; font-size: 12px; color: #999;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} Hazel (SBS Textiles). All rights reserved.</p>
          <p style="margin: 4px 0 0;">www.hazelcart.com</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `Invoice-${orderNum}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [CUSTOMER EMAIL SENT] Order: #${orderNum} | To: ${recipientEmail} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`⚠️ [CUSTOMER EMAIL ERROR] Failed to send email to ${recipientEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Sends order invoice alert email to the admin with PDF attachment.
 * @param {Object} params
 * @param {Object} params.order - Populated order object
 * @param {Buffer} params.pdfBuffer - PDF invoice buffer
 * @param {string} [params.adminEmail] - Target admin email (defaults to env)
 */
const sendAdminInvoiceEmail = async ({ order, pdfBuffer, adminEmail }) => {
  const targetEmail =
    adminEmail ||
    process.env.ADMIN_EMAIL ||
    process.env.MAIL_USER ||
    "mounttowntech@gmail.com";

  // Clean recipients (supports comma-separated list)
  const recipients = String(targetEmail)
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));

  if (recipients.length === 0) {
    console.log("ℹ️ [ADMIN EMAIL SKIPPED] No valid admin email provided.");
    return { success: false, message: "No recipient email provided" };
  }

  const orderNum = order.orderNumber || order._id;
  const customerName = order.billingAddress?.name || order.shippingAddress?.name || "Customer";
  const customerPhone = order.shippingAddress?.mobileNumber || order.billingAddress?.mobileNumber || "-";
  const customerEmail = order.shippingAddress?.email || order.billingAddress?.email || order.user?.email || "-";
  const senderEmail = process.env.MAIL_USER || "mounttowntech@gmail.com";

  const mailOptions = {
    from: `"Hazel Orders" <${senderEmail}>`,
    to: recipients.join(", "),
    subject: `[Admin Alert] Payment Received for Order #${orderNum} - Rs. ${order.totalAmount}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; color: #222;">
        <div style="background-color: #111; color: #fff; padding: 14px 20px; border-radius: 6px 6px 0 0;">
          <h2 style="margin: 0; font-size: 18px; color: #E2BC5D;">Hazel Admin Alert: Payment Completed</h2>
        </div>

        <div style="padding: 20px 0;">
          <p style="font-size: 15px; line-height: 1.5;">
            A new payment has been completed for Order <strong>#${orderNum}</strong>.
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 15px 0;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;">Customer Name:</td>
              <td style="padding: 8px 0; font-weight: bold;">${customerName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;">Mobile Number:</td>
              <td style="padding: 8px 0; font-weight: bold;">${customerPhone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;">Email:</td>
              <td style="padding: 8px 0;">${customerEmail}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;">Amount Paid:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #2E7D32;">Rs. ${Number(order.totalAmount || 0).toLocaleString("en-IN")}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;">Payment Method:</td>
              <td style="padding: 8px 0;">${order.paymentMethod || "ONLINE"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;">Razorpay ID:</td>
              <td style="padding: 8px 0;">${order.razorpayPaymentId || "-"}</td>
            </tr>
          </table>

          <p style="font-size: 14px; color: #333;">
            📄 <strong>The invoice PDF is attached for administrative printing and records.</strong>
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `Invoice-${orderNum}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [ADMIN EMAIL SENT] Order: #${orderNum} | To: ${targetEmail} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`⚠️ [ADMIN EMAIL ERROR] Failed to send email to ${targetEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendCustomerInvoiceEmail,
  sendAdminInvoiceEmail,
};
