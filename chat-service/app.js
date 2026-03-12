const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const logger = require("./config/logger");
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

// ── Global request logger ────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.on("finish", () => {
    logger.info({
      event: "request",
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      userId: req.headers["x-user-id"] || "-",
      ip: req.ip || "-",
    });
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "chat-service" });
});

app.use("/api", chatRoutes);

app.use((err, _req, res, _next) => {
  logger.error({ event: "unhandled_error", err });
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    logger.info({
      event: "startup",
      port: { status: e("PORT"), value: config.server.port },
      nodeEnv: { status: e("NODE_ENV"), value: config.server.env },
      anthropicApiKey: { status: e("ANTHROPIC_API_KEY"), present: !!config.claude.apiKey },
      claudeModel: { status: e("CLAUDE_MODEL"), value: config.claude.model },
      claudeTemperature: { status: e("CLAUDE_TEMPERATURE"), value: config.claude.temperature },
      claudeMaxTokens: { status: e("CLAUDE_MAX_TOKENS"), value: config.claude.maxTokens },
      maxHistoryMessages: { status: e("MAX_HISTORY_MESSAGES"), value: config.conversation.maxHistoryMessages },
      redisUrl: { status: e("REDIS_URL"), value: maskUri(config.redis.url) },
      favoritesServiceUrl: { status: e("FAVORITES_SERVICE_URL"), value: config.services.favoritesUrl },
      booksServiceUrl: { status: e("BOOKS_SERVICE_URL"), value: config.services.booksUrl },
      analysisServiceUrl: { status: e("ANALYSIS_SERVICE_URL"), value: config.services.analysisUrl },
    });
    if (!process.env.ANTHROPIC_API_KEY)     logger.warn({ event: "startup_warning", variable: "ANTHROPIC_API_KEY", msg: "not set — all chat requests will fail" });
    if (!process.env.REDIS_URL)             logger.warn({ event: "startup_warning", variable: "REDIS_URL", msg: "not set — will fail in production" });
    if (!process.env.FAVORITES_SERVICE_URL) logger.warn({ event: "startup_warning", variable: "FAVORITES_SERVICE_URL", msg: "not set — will fail in production" });
    if (!process.env.BOOKS_SERVICE_URL)     logger.warn({ event: "startup_warning", variable: "BOOKS_SERVICE_URL", msg: "not set — will fail in production" });
    if (!process.env.ANALYSIS_SERVICE_URL)  logger.warn({ event: "startup_warning", variable: "ANALYSIS_SERVICE_URL", msg: "not set — will fail in production" });
  });
}

module.exports = app;
