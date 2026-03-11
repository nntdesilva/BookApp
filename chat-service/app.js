const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const chatRoutes = require("./routes/chatRoutes");

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
  res.json({ status: "ok", service: "chat-service" });
});

app.use("/api", chatRoutes);

app.use((err, _req, res, _next) => {
  console.error("[chat-service] Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    console.log("[chat-service] ── startup config ──────────────────────────");
    console.log(`[chat-service] PORT                  : ${e("PORT")} → ${config.server.port}`);
    console.log(`[chat-service] NODE_ENV              : ${e("NODE_ENV")} → ${config.server.env}`);
    console.log(`[chat-service] ANTHROPIC_API_KEY     : ${e("ANTHROPIC_API_KEY")} (present=${!!config.claude.apiKey})`);
    console.log(`[chat-service] CLAUDE_MODEL          : ${e("CLAUDE_MODEL")} → ${config.claude.model}`);
    console.log(`[chat-service] CLAUDE_TEMPERATURE    : ${e("CLAUDE_TEMPERATURE")} → ${config.claude.temperature}`);
    console.log(`[chat-service] CLAUDE_MAX_TOKENS     : ${e("CLAUDE_MAX_TOKENS")} → ${config.claude.maxTokens}`);
    console.log(`[chat-service] MAX_HISTORY_MESSAGES  : ${e("MAX_HISTORY_MESSAGES")} → ${config.conversation.maxHistoryMessages}`);
    console.log(`[chat-service] REDIS_URL             : ${e("REDIS_URL")} → ${maskUri(config.redis.url)}`);
    console.log(`[chat-service] FAVORITES_SERVICE_URL : ${e("FAVORITES_SERVICE_URL")} → ${config.services.favoritesUrl}`);
    console.log(`[chat-service] BOOKS_SERVICE_URL     : ${e("BOOKS_SERVICE_URL")} → ${config.services.booksUrl}`);
    console.log(`[chat-service] ANALYSIS_SERVICE_URL  : ${e("ANALYSIS_SERVICE_URL")} → ${config.services.analysisUrl}`);
    console.log("[chat-service] ────────────────────────────────────────────");
    if (!process.env.ANTHROPIC_API_KEY)     console.warn("[chat-service] WARNING: ANTHROPIC_API_KEY not set — all chat requests will fail");
    if (!process.env.REDIS_URL)             console.warn("[chat-service] WARNING: REDIS_URL not set — using local redis fallback, will fail in production");
    if (!process.env.FAVORITES_SERVICE_URL) console.warn("[chat-service] WARNING: FAVORITES_SERVICE_URL not set — using localhost fallback, will fail in production");
    if (!process.env.BOOKS_SERVICE_URL)     console.warn("[chat-service] WARNING: BOOKS_SERVICE_URL not set — using localhost fallback, will fail in production");
    if (!process.env.ANALYSIS_SERVICE_URL)  console.warn("[chat-service] WARNING: ANALYSIS_SERVICE_URL not set — using localhost fallback, will fail in production");
  });
}

module.exports = app;
