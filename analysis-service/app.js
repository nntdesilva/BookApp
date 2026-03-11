const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const analysisRoutes = require("./routes/analysisRoutes");

function maskUri(uri) {
  try {
    const u = new URL(uri);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return uri.replace(/:\/\/[^@]*@/, "://*:*@");
  }
}

const app = express();

app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "analysis-service" });
});

app.use("/api/analysis", analysisRoutes);

app.use((err, _req, res, _next) => {
  console.error("[analysis-service] Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    console.log("[analysis-service] ── startup config ──────────────────────────");
    console.log(`[analysis-service] PORT              : ${e("PORT")} → ${config.server.port}`);
    console.log(`[analysis-service] NODE_ENV          : ${e("NODE_ENV")} → ${config.server.env}`);
    console.log(`[analysis-service] ANTHROPIC_API_KEY : ${e("ANTHROPIC_API_KEY")} (present=${!!config.claude.apiKey})`);
    console.log(`[analysis-service] CLAUDE_MODEL      : ${e("CLAUDE_MODEL")} → ${config.claude.model}`);
    console.log(`[analysis-service] REDIS_URL         : ${e("REDIS_URL")} → ${maskUri(config.redis.url)}`);
    console.log(`[analysis-service] BOOKS_SERVICE_URL : ${e("BOOKS_SERVICE_URL")} → ${config.services.booksUrl}`);
    console.log("[analysis-service] ────────────────────────────────────────────");
    if (!process.env.ANTHROPIC_API_KEY) console.warn("[analysis-service] WARNING: ANTHROPIC_API_KEY not set — all analysis requests will fail");
    if (!process.env.REDIS_URL)         console.warn("[analysis-service] WARNING: REDIS_URL not set — using local redis fallback, will fail in production");
    if (!process.env.BOOKS_SERVICE_URL) console.warn("[analysis-service] WARNING: BOOKS_SERVICE_URL not set — using localhost fallback, will fail in production");
  });
}

module.exports = app;
