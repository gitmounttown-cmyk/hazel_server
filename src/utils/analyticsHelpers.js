const UAParser = require("ua-parser-js");

function parseUserAgent(userAgent = "") {
  const parsed = new UAParser(userAgent).getResult();
  const deviceType = parsed.device.type || (parsed.os.name ? "desktop" : "Unknown");
  return {
    deviceType: deviceType === "mobile" ? "Mobile" :
      deviceType === "tablet" ? "Tablet" :
      deviceType === "desktop" ? "Desktop" : "Unknown",
    os: [parsed.os.name, parsed.os.version].filter(Boolean).join(" ") || "Unknown",
    browser: [parsed.browser.name, parsed.browser.version].filter(Boolean).join(" ") || "Unknown",
  };
}

function getTraffic(utmSource, utmMedium, referrer) {
  if (utmSource || utmMedium) {
    return {
      source: (utmSource || "unknown").toLowerCase(),
      medium: (utmMedium || "unknown").toLowerCase(),
    };
  }
  if (!referrer) return { source: "direct", medium: "none" };
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes("google.") || host.includes("bing.") || host.includes("duckduckgo.")) {
      return { source: host, medium: "organic" };
    }
    if (host.includes("instagram.") || host.includes("facebook.") || host.includes("tiktok.") ||
        host.includes("youtube.") || host.includes("linkedin.")) {
      return { source: host, medium: "social" };
    }
    return { source: host, medium: "referral" };
  } catch {
    return { source: "unknown", medium: "unknown" };
  }
}

function dateBounds(from, to) {
  if (!from || !to) {
    const error = new Error("Both from and to dates are required (YYYY-MM-DD).");
    error.status = 400;
    throw error;
  }
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  if (!valid.test(from) || !valid.test(to)) {
    const error = new Error("Dates must use YYYY-MM-DD.");
    error.status = 400;
    throw error;
  }
  // Use India local day boundaries expressed as UTC instants (+05:30).
  const start = new Date(`${from}T00:00:00+05:30`);
  const endExclusive = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime()) || start >= endExclusive) {
    const error = new Error("Invalid date range.");
    error.status = 400;
    throw error;
  }
  return { $gte: start, $lt: endExclusive };
}

module.exports = { parseUserAgent, getTraffic, dateBounds };
