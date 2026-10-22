const crypto = require("crypto");
const VisitorSession = require("../models/VisitorSession");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const { parseUserAgent, getTraffic } = require("../utils/analyticsHelpers");

const ALLOWED_EVENTS = new Set([
  "page_view", "product_view", "add_to_cart", "checkout_started",
  "purchase", "whatsapp_click", "product_search", "session_end"
]);

function cleanString(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

// Optional integration point: set location via a trusted IP geolocation provider here.
// This starter intentionally does not persist IP addresses or call an external provider.
async function resolveLocation() {
  return { country: "Unknown", state: "Unknown", city: "Unknown" };
}

exports.collectEvent = async (req, res) => {
  try {
    const body = req.body || {};
    const eventName = cleanString(body.eventName, 50);
    const sessionId = cleanString(body.sessionId, 100);
    const visitorId = cleanString(body.visitorId, 100);
    if (!ALLOWED_EVENTS.has(eventName)) return res.status(400).json({ success: false, message: "Unsupported event." });
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(sessionId) || !/^[A-Za-z0-9_-]{8,100}$/.test(visitorId)) {
      return res.status(400).json({ success: false, message: "Invalid analytics identifiers." });
    }

    const now = new Date();
    const path = cleanString(body.path, 500) || "/";
    const referrer = cleanString(body.referrer, 1000);
    const utm = body.utm && typeof body.utm === "object" ? body.utm : {};
    const utmSource = cleanString(utm.source, 150);
    const utmMedium = cleanString(utm.medium, 150);
    const utmCampaign = cleanString(utm.campaign, 200);
    const utmContent = cleanString(utm.content, 200);
    const utmTerm = cleanString(utm.term, 200);
    const traffic = getTraffic(utmSource, utmMedium, referrer);
    const ua = parseUserAgent(req.get("user-agent") || "");
    const location = await resolveLocation(req);

    let session = await VisitorSession.findOne({ sessionId });
    if (!session) {
      const priorSession = await VisitorSession.exists({ visitorId });
      session = new VisitorSession({
        sessionId, visitorId, startedAt: now, lastActivityAt: now,
        isNewVisitor: !priorSession,
        ...ua, ...location,
        trafficSource: traffic.source, trafficMedium: traffic.medium,
        campaignName: utmCampaign, adContent: utmContent,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        landingPage: path, exitPage: path,
      });
    }

    // Prevent duplicate purchase records for the same order within analytics.
    const orderId = cleanString(body.orderId, 150);
    if (eventName === "purchase" && orderId) {
      const duplicate = await AnalyticsEvent.exists({ eventName: "purchase", orderId });
      if (duplicate) {
        session.lastActivityAt = now;
        session.exitPage = path;
        await session.save();
        return res.status(200).json({ success: true, duplicate: true });
      }
    }

    const event = new AnalyticsEvent({
      eventId: cleanString(body.eventId, 100) || crypto.randomUUID(),
      eventName, occurredAt: now, sessionId, visitorId, path, referrer,
      productId: cleanString(body.productId, 150),
      productName: cleanString(body.productName, 300),
      sku: cleanString(body.sku, 100),
      category: cleanString(body.category, 150),
      quantity: numberOr(body.quantity),
      amount: numberOr(body.amount),
      currency: cleanString(body.currency, 10) || "INR",
      orderId,
      searchQuery: cleanString(body.query, 300),
      resultsCount: body.resultsCount == null ? null : numberOr(body.resultsCount),
      campaign: utmCampaign,
      source: traffic.source, medium: traffic.medium,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });
    await event.save();

    session.lastActivityAt = now;
    session.exitPage = path;
    if (eventName === "page_view") session.pagesViewed += 1;
    if (eventName === "product_view") session.productViewCount += 1;
    if (eventName === "add_to_cart") session.addToCartCount += 1;
    if (eventName === "checkout_started") session.checkoutStarted = true;
    if (eventName === "purchase") {
      session.purchaseCompleted = true;
      session.purchaseCount += 1;
      session.revenue += numberOr(body.amount);
    }
    if (eventName === "whatsapp_click") session.whatsappClickCount += 1;
    if (eventName === "product_search") session.searchCount += 1;
    if (eventName === "session_end") session.endedAt = now;
    session.durationSeconds = Math.max(session.durationSeconds || 0, Math.floor((now - session.startedAt) / 1000));
    await session.save();

    return res.status(202).json({ success: true });
  } catch (error) {
    if (error.code === 11000) return res.status(200).json({ success: true, duplicate: true });
    console.error("Analytics collection error:", error);
    return res.status(500).json({ success: false, message: "Unable to record analytics event." });
  }
};
