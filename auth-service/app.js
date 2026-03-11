const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service", uptime: process.uptime() });
});

app.use("/api/auth", authRoutes);

app.use((err, _req, res, _next) => {
  console.error("[auth-service] Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    console.log("[auth-service] ── startup config ──────────────────────────");
    console.log(`[auth-service] PORT             : ${e("PORT")} → ${config.server.port}`);
    console.log(`[auth-service] NODE_ENV         : ${e("NODE_ENV")} → ${config.server.env}`);
    console.log(`[auth-service] MONGODB_URI      : ${e("MONGODB_URI")} → ${maskUri(config.mongodb.uri)}`);
    console.log(`[auth-service] JWT_SECRET       : ${e("JWT_SECRET")} (length=${config.jwt.secret.length} hint=${config.jwt.secret.slice(0, 4)}...)`);
    console.log(`[auth-service] JWT_EXPIRES_IN   : ${e("JWT_EXPIRES_IN")} → ${config.jwt.expiresIn}`);
    console.log("[auth-service] ────────────────────────────────────────────");
    if (!process.env.MONGODB_URI) console.warn("[auth-service] WARNING: MONGODB_URI not set — using local fallback, will fail in production");
    if (!process.env.JWT_SECRET)  console.warn("[auth-service] WARNING: JWT_SECRET not set — using insecure dev default, tokens will mismatch in production");
    connectDB(config.mongodb.uri);
  });
}

module.exports = app;
