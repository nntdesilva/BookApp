const express = require("express");
const path = require("path");

// Load .env from project root (books-service runs from its own dir)
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

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

if (require.main === module) {
  app.listen(config.server.port, () => {
    console.log(`[books-service] Running on port ${config.server.port}`);
  });
}

module.exports = app;
