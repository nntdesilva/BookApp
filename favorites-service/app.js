const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const { connectDB } = require("./config/database");
const favoritesRoutes = require("./routes/favoritesRoutes");

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "favorites-service" });
});

app.use("/api/favorites", favoritesRoutes);

app.use((err, _req, res, _next) => {
  console.error("[favorites-service] Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    console.log(`[favorites-service] Running on port ${config.server.port}`);
    connectDB(config.mongodb.uri);
  });
}

module.exports = app;
