const express = require("express");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const config = require("./config/appConfig");
const logger = require("./config/logger");
const { connectDB } = require("./config/database");
const favoritesRoutes = require("./routes/favoritesRoutes");

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

app.use(express.json());

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
  res.json({ status: "ok", service: "favorites-service", uptime: process.uptime() });
});

app.use("/api/favorites", favoritesRoutes);

app.use((err, _req, res, _next) => {
  logger.error({ event: "unhandled_error", err });
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    logger.info({
      event: "startup",
      port: { status: e("FAVORITES_SERVICE_PORT"), value: config.server.port },
      nodeEnv: { status: e("NODE_ENV"), value: config.server.env },
      mongodbUri: { status: e("MONGODB_URI"), value: maskUri(config.mongodb.uri) },
      jwtSecret: { status: e("JWT_SECRET"), length: config.jwt.secret.length, hint: config.jwt.secret.slice(0, 4) + "..." },
    });
    if (!process.env.MONGODB_URI) logger.warn({ event: "startup_warning", variable: "MONGODB_URI", msg: "not set — will fail in production" });
    if (!process.env.JWT_SECRET)  logger.warn({ event: "startup_warning", variable: "JWT_SECRET", msg: "not set — tokens will mismatch in production" });
    connectDB(config.mongodb.uri);
  });
}

module.exports = app;
