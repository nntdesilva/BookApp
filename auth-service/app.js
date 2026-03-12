const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const logger = require("./config/logger");
const { connectDB } = require("./config/database");
const authRoutes = require("./routes/authRoutes");

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
app.use(express.urlencoded({ extended: true }));

// ── Global request logger ────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.on("finish", () => {
    logger.info({
      event: "request",
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ip: req.ip || "-",
      contentType: req.headers["content-type"] || "-",
    });
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service", uptime: process.uptime() });
});

app.use("/api/auth", authRoutes);

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
      mongodbUri: { status: e("MONGODB_URI"), value: maskUri(config.mongodb.uri) },
      jwtSecret: { status: e("JWT_SECRET"), length: config.jwt.secret.length, hint: config.jwt.secret.slice(0, 4) + "..." },
      jwtExpiresIn: { status: e("JWT_EXPIRES_IN"), value: config.jwt.expiresIn },
    });
    if (!process.env.MONGODB_URI) logger.warn({ event: "startup_warning", variable: "MONGODB_URI", msg: "not set — using local fallback, will fail in production" });
    if (!process.env.JWT_SECRET)  logger.warn({ event: "startup_warning", variable: "JWT_SECRET", msg: "not set — tokens will mismatch in production" });
    connectDB(config.mongodb.uri);
  });
}

module.exports = app;
