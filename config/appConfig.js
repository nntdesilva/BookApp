/**
 * Application Configuration
 * Centralized configuration for the application
 */

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
  },

  // MongoDB configuration
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bookapp",
  },

  // Session configuration
  session: {
    secret:
      process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      httpOnly: true,
    },
  },

  // Claude configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
  },

  // Conversation settings
  conversation: {
    maxHistoryMessages: parseInt(process.env.MAX_HISTORY_MESSAGES) || 15,
  },

  // OpenAI Embedding configuration (used ONLY for semantic word search)
  embedding: {
    apiKey: process.env.OPENAI_EMBEDDINGS_API_KEY,
    model: process.env.EMBEDDING_MODEL || "text-embedding-3-large",
    similarityThreshold:
      parseFloat(process.env.EMBEDDING_SIMILARITY_THRESHOLD) || 0.55,
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 2048,
  },

  // Project Gutenberg configuration
  gutenberg: {
    apiBaseUrl: process.env.GUTENBERG_API_URL || "https://gutendex.com",
  },
};
