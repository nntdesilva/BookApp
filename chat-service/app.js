const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const chatRoutes = require("./routes/chatRoutes");

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

app.listen(config.server.port, () => {
  console.log(`[chat-service] Running on port ${config.server.port}`);
});
