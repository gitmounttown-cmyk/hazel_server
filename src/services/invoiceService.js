const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const formatINR = (val) => {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (dateInput) => {
  if (!dateInput) return new Date().toLocaleDateString("en-IN");
  const d = new Date(dateInput);
  return isNaN(d.getTime())
    ? new Date().toLocaleDateString("en-IN")
    : d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

/**
 * Resolves the logo path for the PDF invoice.
 */
const getLogoPath = () => {
  const candidatePaths = [
    path.join(process.cwd(), "uploads", "logo.png"),
    path.join(process.cwd(), "uploads", "hazel_brand.png"),
    path.join(process.cwd(), "..", "Hazel_Client", "src", "assets", "images", "Logo.png"),
    path.join(process.cwd(), "..", "Hazel_Client", "src", "assets", "images", "hazel_logo.jpg"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

/**
 * Generates an Invoice PDF stream / buffer for a given Order document.
 * @param {Object} order - Populated Order document (with items, user, etc.)
 * @returns {Promise<Buffer>} - Resolves with PDF Buffer
 */
const generateInvoicePDFBuffer = (order) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
        info: {
          Title: `Invoice-${order.orderNumber || order._id}`,
          Author: "Hazel - SBS Textiles",
          Subject: "Tax Invoice",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#111111";
      const secondaryColor = "#444444";
      const goldColor = "#9A7328";
      const lightBg = "#F8F8F8";
      const borderColor = "#E5E5E5";
      const greenPaid = "#1B7339";

      // -------------------------------------------------------------
      // TOP HEADER: BRAND LOGO & SELLER DETAILS WITH AMPLE SPACING
      // -------------------------------------------------------------
      const logoPath = getLogoPath();
      const logoY = 22;
      const logoWidth = 68;
      const textStartY = 92; // Ample spacing below logo so logo and SBS Textiles never touch

      if (logoPath) {
        try {
          doc.image(logoPath, 40, logoY, { width: logoWidth });
        } catch (imgErr) {
          doc
            .fontSize(22)
            .font("Helvetica-Bold")
            .fillColor(primaryColor)
            .text("HAZEL", 40, logoY);
        }
      } else {
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .fillColor(primaryColor)
          .text("HAZEL", 40, logoY);
      }

      // Seller Details (SBS Textiles) with clear space below the logo
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("SBS TEXTILES", 40, textStartY);

      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text("NO:51, VENKIDUSAMY ROAD, METTUPALAYAM, 641301", 40, textStartY + 12)
        .text("COIMBATORE, TAMIL NADU", 40, textStartY + 22)
        .text("GSTIN : 33CRYPM4674D1ZB", 40, textStartY + 32)
        .text("Ph no : +91 86673 01625 | Email: mounttowntech@gmail.com", 40, textStartY + 42);

      // -------------------------------------------------------------
      // TOP RIGHT: TAX INVOICE DETAILS
      // -------------------------------------------------------------
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("TAX INVOICE", 340, 24, { align: "right" });

      const invoiceNum = `INV-${order.orderNumber || order._id}`;
      const orderDate = formatDate(order.createdAt || Date.now());

      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(`Invoice No: ${invoiceNum}`, 340, 48, { align: "right" })
        .text(`Invoice Date: ${orderDate}`, 340, 61, { align: "right" })
        .text(`Order ID: #${order.orderNumber || order._id}`, 340, 74, { align: "right" });

      const isPaid = String(order.paymentStatus || "").toUpperCase() === "PAID";
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(isPaid ? greenPaid : "#C05621")
        .text(
          `Payment: ${isPaid ? "PAID" : order.paymentStatus || "PENDING"} (${order.paymentMethod || "ONLINE"})`,
          340,
          88,
          { align: "right" }
        );

      if (order.razorpayPaymentId) {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(secondaryColor)
          .text(`Razorpay ID: ${order.razorpayPaymentId}`, 340, 102, { align: "right" });
      }

      // Divider line
      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(40, 152)
        .lineTo(555, 152)
        .stroke();

      // -------------------------------------------------------------
      // ADDRESS BOXES:
      // Left: BILLING ADDRESS (CUSTOMER)
      // Right: SHIPPING ADDRESS (CUSTOMER)
      // -------------------------------------------------------------
      const shipping = order.shippingAddress || {};
      const billing =
        order.billingAddress &&
        (order.billingAddress.addressLine1 ||
          order.billingAddress.fullName ||
          order.billingAddress.name)
          ? order.billingAddress
          : shipping;

      const customerName =
        shipping.name ||
        shipping.fullName ||
        order.user?.name ||
        "Valued Customer";

      const customerMobile =
        shipping.mobileNumber ||
        shipping.phone ||
        order.user?.mobileNumber ||
        "-";

      const customerEmail =
        shipping.email ||
        order.user?.email ||
        order.customerEmail ||
        "-";

      const customerAddressLines = [
        shipping.addressLine1 || shipping.houseNo,
        shipping.addressLine2,
        shipping.district,
        shipping.city ? `${shipping.city}${shipping.state ? ", " + shipping.state : ""}` : "",
        shipping.pincode ? `PIN: ${shipping.pincode}` : "",
        shipping.country || "India",
      ]
        .filter(Boolean)
        .join(", ");

      const billingName =
        billing.name ||
        billing.fullName ||
        customerName;

      const billingMobile =
        billing.mobileNumber ||
        billing.phone ||
        customerMobile;

      const billingEmail =
        billing.email ||
        customerEmail;

      const billingAddressLines = [
        billing.addressLine1 || billing.houseNo,
        billing.addressLine2,
        billing.district,
        billing.city ? `${billing.city}${billing.state ? ", " + billing.state : ""}` : "",
        billing.pincode ? `PIN: ${billing.pincode}` : "",
        billing.country || "India",
      ]
        .filter(Boolean)
        .join(", ");

      const addressBoxY = 160;
      const boxHeight = 98;

      // Left Box: BILLING ADDRESS (CUSTOMER)
      doc
        .rect(40, addressBoxY, 250, boxHeight)
        .fillColor("#FAFAFA")
        .fill();

      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .rect(40, addressBoxY, 250, boxHeight)
        .stroke();

      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor(goldColor)
        .text("BILLING ADDRESS (CUSTOMER):", 50, addressBoxY + 8);

      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text(billingName, 50, addressBoxY + 22, { width: 230, ellipsis: true });

      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(billingAddressLines || customerAddressLines || "Billing address on file", 50, addressBoxY + 36, {
          width: 230,
          height: 30,
          ellipsis: true,
        });

      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("Ph no:", 50, addressBoxY + 71);

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(billingMobile, 82, addressBoxY + 71);

      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("Email:", 50, addressBoxY + 83);

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(billingEmail, 82, addressBoxY + 83, { width: 198, ellipsis: true });

      // Right Box: SHIPPING ADDRESS (CUSTOMER)
      doc
        .rect(305, addressBoxY, 250, boxHeight)
        .fillColor("#FAFAFA")
        .fill();

      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .rect(305, addressBoxY, 250, boxHeight)
        .stroke();

      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor(goldColor)
        .text("SHIPPING ADDRESS (CUSTOMER):", 315, addressBoxY + 8);

      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text(customerName, 315, addressBoxY + 22, { width: 230, ellipsis: true });

      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(customerAddressLines || "Shipping address on file", 315, addressBoxY + 36, {
          width: 230,
          height: 30,
          ellipsis: true,
        });

      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("Ph no:", 315, addressBoxY + 71);

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(customerMobile, 347, addressBoxY + 71);

      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("Email:", 315, addressBoxY + 83);

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(customerEmail, 347, addressBoxY + 83, { width: 198, ellipsis: true });

      // -------------------------------------------------------------
      // ITEMS TABLE
      // -------------------------------------------------------------
      const tableTop = 268;

      // Table Header Background
      doc
        .rect(40, tableTop, 515, 22)
        .fillColor(lightBg)
        .fill();

      doc.strokeColor(borderColor).lineWidth(1).rect(40, tableTop, 515, 22).stroke();

      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("#", 48, tableTop + 6, { width: 20 })
        .text("ITEM DESCRIPTION", 75, tableTop + 6, { width: 215 })
        .text("SIZE / COLOR", 295, tableTop + 6, { width: 95 })
        .text("QTY", 395, tableTop + 6, { width: 30, align: "center" })
        .text("PRICE", 435, tableTop + 6, { width: 55, align: "right" })
        .text("TOTAL", 495, tableTop + 6, { width: 55, align: "right" });

      let curY = tableTop + 24;
      const items = Array.isArray(order.items) ? order.items : [];

      items.forEach((item, index) => {
        const itemY = curY;
        const name = item.productName || item.name || "Product Item";
        const size = item.size || "-";
        const color = item.color || "-";
        const qty = item.quantity || item.units || 1;
        const price = Number(item.sellingPrice || item.price || 0);
        const total = Number(item.totalPrice || price * qty);

        // Alternate row shading
        if (index % 2 === 1) {
          doc.rect(40, itemY, 515, 22).fillColor("#FCFCFC").fill();
        }

        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(secondaryColor)
          .text(String(index + 1), 48, itemY + 6, { width: 20 })
          .font("Helvetica-Bold")
          .fillColor(primaryColor)
          .text(name, 75, itemY + 6, { width: 215, ellipsis: true })
          .font("Helvetica")
          .fillColor(secondaryColor)
          .text(`${size} / ${color}`, 295, itemY + 6, { width: 95, ellipsis: true })
          .text(String(qty), 395, itemY + 6, { width: 30, align: "center" })
          .text(formatINR(price), 435, itemY + 6, { width: 55, align: "right" })
          .font("Helvetica-Bold")
          .fillColor(primaryColor)
          .text(formatINR(total), 495, itemY + 6, { width: 55, align: "right" });

        // Bottom border for row
        doc
          .strokeColor(borderColor)
          .lineWidth(0.5)
          .moveTo(40, itemY + 22)
          .lineTo(555, itemY + 22)
          .stroke();

        curY += 22;
      });

      // -------------------------------------------------------------
      // TOTALS BREAKDOWN
      // -------------------------------------------------------------
      const totalsY = Math.max(curY + 14, 405);

      const subtotal = Number(order.subtotal || 0);
      const discount = Number(order.discountAmount || 0);
      const shippingFee = Number(order.shippingCharge || 0);
      const tax = Number(order.taxAmount || 0);
      const totalAmount = Number(order.totalAmount || subtotal - discount + shippingFee + tax);

      const totalsLeftLabel = 350;
      const totalsRightVal = 475;
      let lineY = totalsY;

      doc.fontSize(8.5).font("Helvetica").fillColor(secondaryColor);

      // Subtotal
      doc.text("Subtotal:", totalsLeftLabel, lineY);
      doc.text(formatINR(subtotal), totalsRightVal, lineY, { width: 75, align: "right" });
      lineY += 15;

      // Discount (if any)
      if (discount > 0) {
        doc.fillColor("#2E7D32").text(`Discount ${order.couponCode ? `(${order.couponCode})` : ""}:`, totalsLeftLabel, lineY);
        doc.text(`- ${formatINR(discount)}`, totalsRightVal, lineY, { width: 75, align: "right" });
        lineY += 15;
      }

      // Shipping
      doc.fillColor(secondaryColor).text("Shipping & Handling:", totalsLeftLabel, lineY);
      doc.text(shippingFee > 0 ? formatINR(shippingFee) : "FREE", totalsRightVal, lineY, { width: 75, align: "right" });
      lineY += 15;

      // Tax
      if (tax > 0) {
        doc.text("Estimated Taxes:", totalsLeftLabel, lineY);
        doc.text(formatINR(tax), totalsRightVal, lineY, { width: 75, align: "right" });
        lineY += 15;
      }

      // Divider for Grand Total
      doc.strokeColor(borderColor).lineWidth(1).moveTo(totalsLeftLabel, lineY).lineTo(555, lineY).stroke();
      lineY += 6;

      // Grand Total Highlight Box
      doc.rect(totalsLeftLabel - 5, lineY - 2, 210, 26).fillColor("#FFF9E6").fill();
      doc.strokeColor(goldColor).lineWidth(1).rect(totalsLeftLabel - 5, lineY - 2, 210, 26).stroke();

      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("TOTAL AMOUNT PAID:", totalsLeftLabel + 5, lineY + 6);

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor(goldColor)
        .text(formatINR(totalAmount), totalsRightVal - 5, lineY + 5, { width: 80, align: "right" });

      // -------------------------------------------------------------
      // FOOTER & LEGAL NOTE
      // -------------------------------------------------------------
      const footerY = 720;

      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(40, footerY)
        .lineTo(555, footerY)
        .stroke();

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("Thank you for shopping with Hazel!", 40, footerY + 10, { align: "center" });

      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(
          "SBS TEXTILES | NO:51, VENKIDUSAMY ROAD, METTUPALAYAM, 641301 | Ph no: +91 86673 01625 | GSTIN: 33CRYPM4674D1ZB",
          40,
          footerY + 23,
          { align: "center" }
        )
        .text(
          "For customer support or queries, contact mounttowntech@gmail.com | www.hazelcart.com",
          40,
          footerY + 34,
          { align: "center" }
        )
        .text(
          "This is a system generated tax invoice and does not require a physical signature.",
          40,
          footerY + 45,
          { align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Saves generated PDF invoice to uploads/invoices directory.
 * @param {Object} order - Populated Order document
 * @returns {Promise<{ filePath: string, fileName: string, relativePath: string, buffer: Buffer }>}
 */
const saveInvoicePDF = async (order) => {
  const invoicesDir = path.join(process.cwd(), "uploads", "invoices");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const safeNumber = (order.orderNumber || order._id || Date.now()).toString().replace(/[^a-zA-Z0-9-_]/g, "");
  const fileName = `Invoice-${safeNumber}.pdf`;
  const filePath = path.join(invoicesDir, fileName);

  const buffer = await generateInvoicePDFBuffer(order);
  await fs.promises.writeFile(filePath, buffer);

  return {
    filePath,
    fileName,
    relativePath: `/uploads/invoices/${fileName}`,
    buffer,
  };
};

module.exports = {
  generateInvoicePDFBuffer,
  saveInvoicePDF,
  formatINR,
  formatDate,
};
