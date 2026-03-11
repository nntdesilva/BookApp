module.exports = {
  server: {
    port: process.env.PORT || 3004,
    env: process.env.NODE_ENV || "development",
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  },
  services: {
    booksUrl: (process.env.BOOKS_SERVICE_URL || "http://localhost:3003").trim(),
  },
};
