const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const analysisRoutes = require("./routes/analysisRoutes");

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
    console.log(`[analysis-service] Running on port ${config.server.port}`);
  });
}

module.exports = app;
