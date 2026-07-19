let serverless;
let loadError;

try {
  serverless = require("../dist/src/serverless.js").default;
} catch (e) {
  loadError = e;
}

function getAllowedOrigins() {
  const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([
    ...configuredOrigins,
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
  ]));
}

function resolveCorsOrigin(requestOrigin) {
  const allowedOrigins = getAllowedOrigins();
  const fallbackOrigin = allowedOrigins[0] || "https://omnia-portal.vercel.app";
  const isProduction = process.env.NODE_ENV === "production";

  if (!requestOrigin) return fallbackOrigin;
  if (!allowedOrigins.length) return isProduction ? fallbackOrigin : requestOrigin;
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin;
  if (!isProduction && requestOrigin.includes("localhost")) return requestOrigin;

  return fallbackOrigin;
}

module.exports = async function(req, res) {
  // Add CORS fallback headers before invoking Nest so errors stay visible to the portal.
  res.setHeader("Access-Control-Allow-Origin", resolveCorsOrigin(req.headers.origin));
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, x-tenant-id, x-branch-id, x-branch-scope");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (loadError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      message: "Module load error",
      error: loadError.message,
      ...(process.env.NODE_ENV === "production" ? {} : { stack: loadError.stack })
    }));
    return;
  }

  try {
    await serverless(req, res);
  } catch (error) {
    console.error("Vercel Serverless Function error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Server initialization failed", error: String(error) }));
  }
};
