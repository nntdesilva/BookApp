const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const booksRoutes = require("./routes/booksRoutes");

const app = express();

app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "books-service" });
});

app.use("/api/books", booksRoutes);

app.use((err, _req, res, _next) => {
  console.error("[books-service] Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.server.port, () => {
  console.log(`[books-service] Running on port ${config.server.port}`);
});
