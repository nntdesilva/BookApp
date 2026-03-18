module.exports = {
  server: {
    port: process.env.CHAT_SERVICE_PORT || 3005,
    env: process.env.NODE_ENV || "development",
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
  },
  conversation: {
    maxHistoryMessages: parseInt(process.env.MAX_HISTORY_MESSAGES) || 15,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  },
  services: {
    favoritesUrl: (
      process.env.FAVORITES_SERVICE_URL || "http://localhost:3002"
    ).trim(),
    booksUrl: (process.env.BOOKS_SERVICE_URL || "http://localhost:3003").trim(),
    analysisUrl: (
      process.env.ANALYSIS_SERVICE_URL || "http://localhost:3004"
    ).trim(),
  },
};
