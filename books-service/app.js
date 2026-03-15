const express = require("express");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const config = require("./config/appConfig");
const logger = require("./config/logger");
const booksRoutes = require("./routes/booksRoutes");

const app = express();

app.use(express.json({ limit: "50mb" }));

// ── Global request logger ────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.on("finish", () => {
    logger.info({
      event: "request",
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ip: req.ip || "-",
    });
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "books-service", uptime: process.uptime() });
});

app.use("/api/books", booksRoutes);

app.use((err, _req, res, _next) => {
  logger.error({ event: "unhandled_error", err });
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    logger.info({
      event: "startup",
      port: { status: e("BOOKS_SERVICE_PORT"), value: config.server.port },
      nodeEnv: { status: e("NODE_ENV"), value: config.server.env },
      openaiEmbeddingsApiKey: { status: e("OPENAI_EMBEDDINGS_API_KEY"), present: !!config.embedding.apiKey },
      embeddingModel: { status: e("EMBEDDING_MODEL"), value: config.embedding.model },
      embeddingSimilarityThreshold: { status: e("EMBEDDING_SIMILARITY_THRESHOLD"), value: config.embedding.similarityThreshold },
      embeddingBatchSize: { status: e("EMBEDDING_BATCH_SIZE"), value: config.embedding.batchSize },
      gutenbergApiUrl: { status: e("GUTENBERG_API_URL"), value: config.gutenberg.apiBaseUrl },
    });
    if (!process.env.OPENAI_EMBEDDINGS_API_KEY) logger.warn({ event: "startup_warning", variable: "OPENAI_EMBEDDINGS_API_KEY", msg: "not set — semantic word search will fail" });
  });
}

module.exports = app;
