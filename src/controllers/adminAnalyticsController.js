const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const VisitorSession = require("../models/VisitorSession");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const { dateBounds } = require("../utils/analyticsHelpers");

const REPORTS = ["sessions", "products", "campaigns", "funnel", "traffic", "whatsapp", "locations", "devices", "searches"];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
function getRange(req) {
  return dateBounds(req.query.from, req.query.to);
}
function reportTitle(key) {
  return ({
    sessions: "Visitor Sessions", products: "Product Performance", campaigns: "Marketing Campaigns",
    funnel: "Customer Funnel", traffic: "Traffic Sources", whatsapp: "WhatsApp Tracking",
    locations: "Customer Locations", devices: "Device Report", searches: "Product Searches"
  })[key] || key;
}
async function buildReport(key, range) {
  if (key === "sessions") {
    const docs = await VisitorSession.find({ startedAt: range }).sort({ startedAt: -1 }).lean();
    return docs.map(s => ({
      date: s.startedAt, time: s.startedAt, sessionId: s.sessionId, visitorId: s.visitorId,
      visitorType: s.isNewVisitor ? "New" : "Returning", country: s.country, state: s.state, city: s.city,
      device: s.deviceType, os: s.os, browser: s.browser, trafficSource: s.trafficSource,
      trafficMedium: s.trafficMedium, campaignName: s.campaignName, adContent: s.adContent,
      utmSource: s.utmSource, utmMedium: s.utmMedium, utmCampaign: s.utmCampaign,
      utmContent: s.utmContent, landingPage: s.landingPage, pagesViewed: s.pagesViewed,
      sessionDurationSeconds: s.durationSeconds, productViews: s.productViewCount,
      addToCart: s.addToCartCount > 0 ? "Yes" : "No", checkoutStarted: s.checkoutStarted ? "Yes" : "No",
      purchase: s.purchaseCompleted ? "Yes" : "No", purchaseCount: s.purchaseCount,
      revenue: round2(s.revenue), whatsappClick: s.whatsappClickCount > 0 ? "Yes" : "No",
      whatsappClicks: s.whatsappClickCount, exitPage: s.exitPage
    }));
  }
  const events = await AnalyticsEvent.find({ occurredAt: range }).lean();
  const sessions = await VisitorSession.find({ startedAt: range }).lean();

  if (key === "products") {
    const map = new Map();
    for (const e of events) {
      if (!e.productId && !e.productName) continue;
      const id = e.productId || e.productName;
      if (!map.has(id)) map.set(id, { productId: e.productId, productName: e.productName, sku: e.sku, category: e.category, views: 0, addToCart: 0, unitsSold: 0, orders: new Set(), revenue: 0 });
      const r = map.get(id);
      if (e.eventName === "product_view") r.views++;
      if (e.eventName === "add_to_cart") r.addToCart += Math.max(1, e.quantity || 1);
      if (e.eventName === "purchase") { r.unitsSold += Math.max(1, e.quantity || 1); if (e.orderId) r.orders.add(e.orderId); r.revenue += e.amount || 0; }
    }
    return [...map.values()].map(r => ({ ...r, orders: r.orders.size, revenue: round2(r.revenue), addToCartRate: r.views ? round2(r.addToCart / r.views * 100) : 0, conversionRate: r.views ? round2(r.orders.size / r.views * 100) : 0 }));
  }
  if (key === "campaigns") {
    const map = new Map();
    for (const e of events) {
      const campaign = e.campaign || "(not set)";
      if (!map.has(campaign)) map.set(campaign, { campaign, source: e.source, medium: e.medium, sessions: new Set(), productViews: 0, addToCart: 0, checkouts: 0, purchases: new Set(), revenue: 0 });
      const r = map.get(campaign); r.sessions.add(e.sessionId);
      if (e.eventName === "product_view") r.productViews++;
      if (e.eventName === "add_to_cart") r.addToCart++;
      if (e.eventName === "checkout_started") r.checkouts++;
      if (e.eventName === "purchase") { if (e.orderId) r.purchases.add(e.orderId); r.revenue += e.amount || 0; }
    }
    return [...map.values()].map(r => ({ campaign: r.campaign, source: r.source, medium: r.medium, sessions: r.sessions.size, productViews: r.productViews, addToCart: r.addToCart, checkouts: r.checkouts, purchases: r.purchases.size, revenue: round2(r.revenue), conversionRate: r.sessions.size ? round2(r.purchases.size / r.sessions.size * 100) : 0 }));
  }
  if (key === "funnel") {
    const counts = {
      "Product Viewed": new Set(events.filter(e => e.eventName === "product_view").map(e => e.sessionId)).size,
      "Added to Cart": new Set(events.filter(e => e.eventName === "add_to_cart").map(e => e.sessionId)).size,
      "Checkout Started": new Set(events.filter(e => e.eventName === "checkout_started").map(e => e.sessionId)).size,
      "Purchase Completed": new Set(events.filter(e => e.eventName === "purchase").map(e => e.sessionId)).size,
    };
    let previous = null;
    return Object.entries(counts).map(([stage, users]) => {
      const row = { stage, sessions: users, dropOffFromPrevious: previous == null ? 0 : Math.max(0, previous - users), conversionFromPreviousPercent: previous == null || previous === 0 ? 100 : round2(users / previous * 100) };
      previous = users; return row;
    });
  }
  if (key === "traffic") {
    const map = new Map();
    for (const s of sessions) {
      const k = `${s.trafficSource || "direct"} / ${s.trafficMedium || "none"}`;
      if (!map.has(k)) map.set(k, { sourceMedium: k, sessions: 0, visitors: new Set(), purchases: 0, revenue: 0 });
      const r = map.get(k); r.sessions++; r.visitors.add(s.visitorId); r.purchases += s.purchaseCount || 0; r.revenue += s.revenue || 0;
    }
    return [...map.values()].map(r => ({ sourceMedium: r.sourceMedium, sessions: r.sessions, uniqueVisitors: r.visitors.size, purchases: r.purchases, revenue: round2(r.revenue) }));
  }
  if (key === "whatsapp") {
    const wa = events.filter(e => e.eventName === "whatsapp_click");
    const map = new Map();
    for (const e of wa) {
      const k = e.path || "/";
      if (!map.has(k)) map.set(k, { page: k, clicks: 0, visitors: new Set(), products: new Set(), sources: new Set() });
      const r = map.get(k); r.clicks++; r.visitors.add(e.visitorId); if (e.productName) r.products.add(e.productName); r.sources.add(e.source || "direct");
    }
    return [...map.values()].map(r => ({ page: r.page, clicks: r.clicks, uniqueVisitors: r.visitors.size, products: [...r.products].join(", "), sources: [...r.sources].join(", ") }));
  }
  if (key === "locations") {
    const map = new Map();
    for (const s of sessions) {
      const k = `${s.country || "Unknown"} / ${s.state || "Unknown"} / ${s.city || "Unknown"}`;
      if (!map.has(k)) map.set(k, { country: s.country, state: s.state, city: s.city, sessions: 0, visitors: new Set() });
      const r = map.get(k); r.sessions++; r.visitors.add(s.visitorId);
    }
    return [...map.values()].map(r => ({ country: r.country, state: r.state, city: r.city, sessions: r.sessions, uniqueVisitors: r.visitors.size }));
  }
  if (key === "devices") {
    const map = new Map();
    for (const s of sessions) {
      const k = `${s.deviceType || "Unknown"} / ${s.os || "Unknown"} / ${s.browser || "Unknown"}`;
      if (!map.has(k)) map.set(k, { device: s.deviceType, os: s.os, browser: s.browser, sessions: 0, visitors: new Set() });
      const r = map.get(k); r.sessions++; r.visitors.add(s.visitorId);
    }
    return [...map.values()].map(r => ({ device: r.device, os: r.os, browser: r.browser, sessions: r.sessions, uniqueVisitors: r.visitors.size }));
  }
  if (key === "searches") {
    const map = new Map();
    for (const e of events.filter(e => e.eventName === "product_search")) {
      const k = (e.searchQuery || "").toLowerCase();
      if (!map.has(k)) map.set(k, { searchQuery: e.searchQuery, searches: 0, visitors: new Set(), totalResults: 0, noResults: 0 });
      const r = map.get(k); r.searches++; r.visitors.add(e.visitorId);
      if (typeof e.resultsCount === "number") { r.totalResults += e.resultsCount; if (e.resultsCount === 0) r.noResults++; }
    }
    return [...map.values()].map(r => ({ searchQuery: r.searchQuery, searches: r.searches, uniqueVisitors: r.visitors.size, averageResults: r.searches ? round2(r.totalResults / r.searches) : 0, noResultSearches: r.noResults }));
  }
  throw Object.assign(new Error("Unknown report."), { status: 400 });
}

exports.getReports = async (req, res) => {
  try {
    const report = String(req.query.report || "");
    if (!REPORTS.includes(report)) return res.status(400).json({ success: false, message: `report must be one of: ${REPORTS.join(", ")}` });
    const rows = await buildReport(report, getRange(req));
    res.json({ success: true, report, title: reportTitle(report), count: rows.length, rows });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message || "Unable to build report." });
  }
};

exports.exportReports = async (req, res) => {
  try {
    const range = getRange(req);
    const format = String(req.query.format || "xlsx").toLowerCase();
    const report = String(req.query.report || "all").toLowerCase();
    if (format === "xlsx" && report === "all") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Hazel Analytics";
      workbook.created = new Date();
      for (const key of REPORTS) {
        const rows = await buildReport(key, range);
        const sheet = workbook.addWorksheet(reportTitle(key).slice(0, 31));
        if (!rows.length) {
          sheet.addRow(["No data for selected date range"]);
          continue;
        }
        const columns = Object.keys(rows[0]);
        sheet.columns = columns.map(c => ({ header: c, key: c, width: Math.min(32, Math.max(14, c.length + 3)) }));
        rows.forEach(row => sheet.addRow(Object.fromEntries(columns.map(c => [c, row[c] instanceof Set ? [...row[c]].join(", ") : row[c]]))));
        sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5A1827" } };
        sheet.views = [{ state: "frozen", ySplit: 1 }];
        sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.min(columns.length, 26))}1` };
      }
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="hazel-analytics-${req.query.from}-to-${req.query.to}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }
    if (!REPORTS.includes(report)) return res.status(400).json({ success: false, message: "Choose a valid report or use report=all with format=xlsx." });
    const rows = await buildReport(report, range);
    const safeName = `hazel-${report}-${req.query.from}-to-${req.query.to}`;
    if (format === "csv") {
      const parser = new Parser({ fields: rows.length ? Object.keys(rows[0]) : ["message"] });
      const csv = rows.length ? parser.parse(rows) : "message\nNo data for selected date range";
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.csv"`);
      return res.send("\uFEFF" + csv);
    }
    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
      const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
      doc.pipe(res);
      doc.fontSize(16).text(`${reportTitle(report)} Report`, { continued: false });
      doc.moveDown(0.4).fontSize(9).text(`Date range: ${req.query.from} to ${req.query.to}`);
      doc.moveDown();
      if (!rows.length) doc.text("No data for selected date range.");
      else {
        const keys = Object.keys(rows[0]);
        doc.fontSize(7).text(keys.join(" | "));
        doc.moveDown(0.3);
        rows.slice(0, 500).forEach(row => {
          const line = keys.map(k => String(row[k] ?? "")).join(" | ");
          doc.text(line, { width: 760 });
          doc.moveDown(0.15);
        });
        if (rows.length > 500) doc.text("PDF limited to first 500 rows. Use Excel/CSV for complete data.");
      }
      doc.end();
      return;
    }
    return res.status(400).json({ success: false, message: "format must be xlsx, csv, or pdf." });
  } catch (error) {
    console.error("Analytics export error:", error);
    if (!res.headersSent) res.status(error.status || 500).json({ success: false, message: error.message || "Export failed." });
  }
};
