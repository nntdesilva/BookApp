const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

require("dotenv").config();

// MCP stdio transport uses stdout for protocol messages.
// Redirect console.log to stderr so service modules don't corrupt the stream.
const originalLog = console.log;
console.log = (...args) => console.error(...args);

const { connectDB } = require("./config/database");
const config = require("./config/appConfig");
const User = require("./models/User");
const favoriteService = require("./services/favoriteService");
const gutenbergService = require("./services/gutenbergService");
const analysisService = require("./services/analysisService");

let cachedUserId = null;

async function resolveUserId() {
  if (cachedUserId) return cachedUserId;

  const username = process.env.BOOK_APP_USERNAME;
  if (!username) {
    throw new Error(
      "BOOK_APP_USERNAME env variable is not set. " +
        "Configure it in .cursor/mcp.json to use favorites tools.",
    );
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error(
      `User "${username}" not found in MongoDB. ` +
        "Make sure the user exists and MONGODB_URI is correct.",
    );
  }

  cachedUserId = user._id;
  return cachedUserId;
}

const server = new McpServer({
  name: "book-app-tools",
  version: "1.0.0",
});

// --- Favorites tools ---

server.tool(
  "add_to_favorites",
  "Add a book to the user's favorites list. Only use for individual books with valid ISBN-13, never for series names.",
  {
    isbn13: z
      .string()
      .describe(
        "The ISBN-13 of the book (exactly 13 digits, no hyphens). Must be a valid ISBN-13.",
      ),
    title: z.string().describe("The full title of the book"),
  },
  async ({ isbn13, title }) => {
    const userId = await resolveUserId();
    const normalizedIsbn = favoriteService.normalizeIsbn13(isbn13);
    const result = await favoriteService.addFavorite(
      userId,
      normalizedIsbn,
      title,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "remove_from_favorites",
  "Remove a book from the user's favorites list by ISBN-13.",
  {
    isbn13: z
      .string()
      .describe(
        "The ISBN-13 of the book to remove (exactly 13 digits)",
      ),
  },
  async ({ isbn13 }) => {
    const userId = await resolveUserId();
    const normalizedIsbn = favoriteService.normalizeIsbn13(isbn13);
    const result = await favoriteService.removeFavorite(userId, normalizedIsbn);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "list_favorites",
  "List all books in the user's favorites list.",
  {},
  async () => {
    const userId = await resolveUserId();
    const result = await favoriteService.listFavorites(userId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "remove_all_favorites",
  "Remove ALL books from the user's favorites list at once. Use when the user asks to clear, remove all, or empty their entire favorites list.",
  {},
  async () => {
    const userId = await resolveUserId();
    const result = await favoriteService.clearFavorites(userId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// --- Gutenberg Word Search tools ---

server.tool(
  "resolve_book_for_search",
  "Check if a book is available for full-text search in Project Gutenberg. Only works for public domain books (published before 1928).",
  {
    bookTitle: z
      .string()
      .describe(
        "The title of the book to search for (use the corrected/proper title)",
      ),
  },
  async ({ bookTitle }) => {
    const result = await gutenbergService.resolveBookForSearch(bookTitle);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "count_word_in_book",
  "Count how many times a word or phrase appears in a book's full text. Only works for books available in Project Gutenberg (public domain).",
  {
    bookTitle: z
      .string()
      .describe(
        "The title of the book to search in (use the corrected/proper title)",
      ),
    searchTerm: z
      .string()
      .describe(
        "The word or phrase to count occurrences of (can be multiple words, case-insensitive)",
      ),
  },
  async ({ bookTitle, searchTerm }) => {
    const result = await gutenbergService.countWordInBook(
      bookTitle,
      searchTerm,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// --- Semantic Search tool ---

server.tool(
  "count_related_words_in_book",
  "Find and count ALL words semantically related to a concept or category in a book's full text. Uses embeddings to identify related words and counts each occurrence precisely. Only works for public domain books in Project Gutenberg.",
  {
    bookTitle: z
      .string()
      .describe(
        "The title of the book to search in (use the corrected/proper title)",
      ),
    concept: z
      .string()
      .describe(
        "The concept or category to find related words for (e.g., 'flowers', 'war', 'emotions', 'colors')",
      ),
  },
  async ({ bookTitle, concept }) => {
    const result = await gutenbergService.countRelatedWordsInBook(
      bookTitle,
      concept,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// --- Code Execution Analysis tools ---

server.tool(
  "analyze_book_statistics",
  "Analyze any arbitrary statistic, pattern, or structural property of a book's full text using code execution. Use this for complex questions that go beyond simple word counting. Only works for public domain books available in Project Gutenberg.",
  {
    bookTitle: z
      .string()
      .describe(
        "The title of the book to analyze (use the corrected/proper title)",
      ),
    question: z
      .string()
      .describe(
        "The user's question or statistic they want to know about the book's text. Be specific.",
      ),
  },
  async ({ bookTitle, question }) => {
    const result = await analysisService.analyzeBookStatistics(
      bookTitle,
      question,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "generate_visualization",
  "Generate an interactive visualization (chart, graph, diagram) of book text analysis results. Creates a rich interactive Plotly.js chart. Only works for public domain books available in Project Gutenberg.",
  {
    bookTitle: z
      .string()
      .describe(
        "The title of the book to analyze and visualize (use the corrected/proper title)",
      ),
    question: z
      .string()
      .describe(
        "What data to compute and visualize from the book's text (e.g., 'top 10 most common words'). Never add 'excluding stop words' — always request raw unfiltered counts.",
      ),
    chartType: z
      .string()
      .describe(
        "The type of chart to create: 'bar chart', 'pie chart', 'line chart', 'scatter plot', 'heatmap', 'histogram', 'treemap', etc.",
      ),
  },
  async ({ bookTitle, question, chartType }) => {
    const result = await analysisService.analyzeAndVisualize(
      bookTitle,
      question,
      chartType,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// --- Start server ---

async function main() {
  await connectDB(config.mongodb.uri);

  // Pre-resolve user if configured (non-fatal — favorites tools will
  // report the error at call time if the user isn't found).
  if (process.env.BOOK_APP_USERNAME) {
    try {
      await resolveUserId();
    } catch {
      // Silently continue — error surfaces when a favorites tool is called.
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal: MCP server failed to start:", err);
  process.exit(1);
});
