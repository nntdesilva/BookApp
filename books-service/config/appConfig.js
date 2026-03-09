module.exports = {
  server: {
    port: process.env.PORT || 3003,
    env: process.env.NODE_ENV || "development",
  },
  embedding: {
    apiKey: process.env.OPENAI_EMBEDDINGS_API_KEY,
    model: process.env.EMBEDDING_MODEL || "text-embedding-3-large",
    similarityThreshold:
      parseFloat(process.env.EMBEDDING_SIMILARITY_THRESHOLD) || 0.55,
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 2048,
  },
  gutenberg: {
    apiBaseUrl: process.env.GUTENBERG_API_URL || "https://gutendex.com",
  },
};
