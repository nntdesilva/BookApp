const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const { connectDB } = require("./config/database");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service" });
});

app.use("/api/auth", authRoutes);

app.use((err, _req, res, _next) => {
  console.error("[auth-service] Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  connectDB(config.mongodb.uri).then(() => {
    app.listen(config.server.port, () => {
      console.log(`[auth-service] Running on port ${config.server.port}`);
    });
  });
}

module.exports = app;
