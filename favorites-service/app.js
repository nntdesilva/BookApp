const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "favorites-service", uptime: process.uptime() });
});

app.use("/api/favorites", favoritesRoutes);

app.use((err, _req, res, _next) => {
  console.error("[favorites-service] Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    console.log("[favorites-service] ── startup config ──────────────────────────");
    console.log(`[favorites-service] PORT             : ${e("PORT")} → ${config.server.port}`);
    console.log(`[favorites-service] NODE_ENV         : ${e("NODE_ENV")} → ${config.server.env}`);
    console.log(`[favorites-service] MONGODB_URI      : ${e("MONGODB_URI")} → ${maskUri(config.mongodb.uri)}`);
    console.log(`[favorites-service] JWT_SECRET       : ${e("JWT_SECRET")} (length=${config.jwt.secret.length} hint=${config.jwt.secret.slice(0, 4)}...)`);
    console.log("[favorites-service] ────────────────────────────────────────────");
    if (!process.env.MONGODB_URI) console.warn("[favorites-service] WARNING: MONGODB_URI not set — using local fallback, will fail in production");
    if (!process.env.JWT_SECRET)  console.warn("[favorites-service] WARNING: JWT_SECRET not set — using insecure dev default, tokens will mismatch in production");
    connectDB(config.mongodb.uri);
  });
}

module.exports = app;
