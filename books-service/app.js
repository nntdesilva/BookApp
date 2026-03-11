const express = require("express");
require("dotenv").config();

const config = require("./config/appConfig");
const booksRoutes = require("./routes/booksRoutes");

const app = express();

app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "books-service", uptime: process.uptime() });
});

app.use("/api/books", booksRoutes);

app.use((err, _req, res, _next) => {
  console.error("[books-service] Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    console.log("[books-service] ── startup config ──────────────────────────");
    console.log(`[books-service] PORT                          : ${e("PORT")} → ${config.server.port}`);
    console.log(`[books-service] NODE_ENV                      : ${e("NODE_ENV")} → ${config.server.env}`);
    console.log(`[books-service] OPENAI_EMBEDDINGS_API_KEY     : ${e("OPENAI_EMBEDDINGS_API_KEY")} (present=${!!config.embedding.apiKey})`);
    console.log(`[books-service] EMBEDDING_MODEL               : ${e("EMBEDDING_MODEL")} → ${config.embedding.model}`);
    console.log(`[books-service] EMBEDDING_SIMILARITY_THRESHOLD: ${e("EMBEDDING_SIMILARITY_THRESHOLD")} → ${config.embedding.similarityThreshold}`);
    console.log(`[books-service] EMBEDDING_BATCH_SIZE          : ${e("EMBEDDING_BATCH_SIZE")} → ${config.embedding.batchSize}`);
    console.log(`[books-service] GUTENBERG_API_URL             : ${e("GUTENBERG_API_URL")} → ${config.gutenberg.apiBaseUrl}`);
    console.log("[books-service] ────────────────────────────────────────────");
    if (!process.env.OPENAI_EMBEDDINGS_API_KEY) console.warn("[books-service] WARNING: OPENAI_EMBEDDINGS_API_KEY not set — semantic word search will fail");
  });
}

module.exports = app;
