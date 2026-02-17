/**
 * Book Controller - Handles HTTP requests and responses for book-related operations
 */

const aiService = require("../services/aiService");
const tagService = require("../services/tagService");
const conversationService = require("../services/conversationService");
const favoriteService = require("../services/favoriteService");
const gutenbergService = require("../services/gutenbergService");
const embeddingService = require("../services/embeddingService");
const analysisService = require("../services/analysisService");
const validators = require("../utils/validators");
const config = require("../config/appConfig");

/**
 * Render the main books index page
 * @route GET /
 */
module.exports.index = (req, res) => {
  // Clear conversation history and visualization cache on page load/refresh
  conversationService.clearConversationHistory(req.session);
  delete req.session.vizDataCache;

  res.render("books/index", {
    error: null,
  });
};

/**
 * Execute an AI-requested function and return the result
 * @param {string} userId - User's MongoDB ID
 * @param {string} functionName - Name of the function to execute
 * @param {Object} args - Function arguments
 * @returns {Promise<Object>} - Function execution result
 */
async function executeFunction(userId, functionName, args, session) {
  switch (functionName) {
    // Favorites functions
    case "add_to_favorites": {
      // Normalize ISBN (remove hyphens/spaces)
      const normalizedIsbn = favoriteService.normalizeIsbn13(args.isbn13);
      return favoriteService.addFavorite(userId, normalizedIsbn, args.title);
    }
    case "remove_from_favorites": {
      const normalizedIsbn = favoriteService.normalizeIsbn13(args.isbn13);
      return favoriteService.removeFavorite(userId, normalizedIsbn);
    }
    case "list_favorites": {
      return favoriteService.listFavorites(userId);
    }

    // Word search functions (Gutenberg)
    case "resolve_book_for_search": {
      return gutenbergService.resolveBookForSearch(args.bookTitle);
    }
    case "count_word_in_book": {
      return gutenbergService.countWordInBook(args.bookTitle, args.searchTerm);
    }

    // Semantic related word count (embeddings + regex)
    case "count_related_words_in_book": {
      // Fetch full book text from Gutenberg
      const bookResult = await gutenbergService.getBookFullText(args.bookTitle);

      if (!bookResult.success) {
        return {
          success: false,
          error: bookResult.error,
          searchedTitle: args.bookTitle,
        };
      }

      // Extract all unique words from the book
      const uniqueWords = gutenbergService.extractUniqueWords(bookResult.text);

      // Use embeddings to find words related to the concept
      const relatedWords = await embeddingService.findRelatedWords(
        args.concept,
        uniqueWords,
      );

      // Count each related word using regex
      const wordCounts = relatedWords.map((entry) => {
        const countResult = gutenbergService.countWordOccurrences(
          bookResult.text,
          entry.word,
        );
        return {
          word: entry.word,
          count: countResult.count,
          similarity: entry.similarity,
        };
      });

      // Filter out words with 0 occurrences and sort by count descending
      const filteredCounts = wordCounts
        .filter((w) => w.count > 0)
        .sort((a, b) => b.count - a.count);

      const totalOccurrences = filteredCounts.reduce(
        (sum, w) => sum + w.count,
        0,
      );

      return {
        success: true,
        bookTitle: bookResult.bookTitle,
        authors: bookResult.authors,
        concept: args.concept,
        relatedWords: filteredCounts,
        totalOccurrences: totalOccurrences,
        uniqueWordsAnalyzed: uniqueWords.length,
      };
    }

    // Arbitrary text analysis (Claude Code Execution)
    case "analyze_book_statistics": {
      return analysisService.analyzeBookStatistics(
        args.bookTitle,
        args.question,
      );
    }

    // Interactive visualization: compute data ONCE, then render as chart
    case "generate_visualization": {
      // Build a cache key from the book title + analysis question.
      // This ensures that switching chart types for the same question
      // reuses the identical computed data instead of recomputing
      // (which could produce non-deterministic results).
      const cacheKey = `${(args.bookTitle || "").toLowerCase().trim()}::${(args.question || "").toLowerCase().trim()}`;

      let analysisResult;

      // Check the session-level cache first
      if (
        session &&
        session.vizDataCache &&
        session.vizDataCache.key === cacheKey
      ) {
        analysisResult = session.vizDataCache.data;
      } else {
        // Cache miss — compute the data via analyzeBookStatistics
        analysisResult = await analysisService.analyzeBookStatistics(
          args.bookTitle,
          args.question,
        );

        // Cache for subsequent requests with different chart types
        if (analysisResult.success && session) {
          session.vizDataCache = { key: cacheKey, data: analysisResult };
        }
      }

      if (!analysisResult.success) {
        return analysisResult;
      }

      // Now generate the chart HTML from the pre-computed data.
      // generateVisualization does NOT compute anything — it only renders.
      return analysisService.generateVisualization(
        analysisResult.answer,
        analysisResult.bookTitle,
        analysisResult.authors,
        args.chartType,
      );
    }

    default:
      return {
        success: false,
        message: `Unknown function: ${functionName}`,
      };
  }
}

/**
 * Handle chat messages from the user
 * @route POST /chat
 */
module.exports.chat = async (req, res) => {
  try {
    const { message } = req.body;

    // Validate input using validator utility
    const validation = validators.validateMessage(message);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
      });
    }

    // Check API configuration
    if (!config.claude.apiKey) {
      return res.status(500).json({
        error: "Claude API key is not configured.",
      });
    }

    // Initialize conversation history if needed
    conversationService.initializeConversation(req.session);

    // Get current conversation history
    const history = conversationService.getConversationHistory(req.session);

    // Generate AI response using the AI service
    let result = await aiService.generateChatResponse(message, history);

    if (result.error) {
      return res.status(500).json({
        error: result.error,
      });
    }

    // Track visualization HTML extracted from function results
    let visualizationHtml = null;

    // Loop to handle multiple rounds of tool calls
    // Claude may call tools sequentially (e.g., resolve_book first, then count_word)
    const MAX_TOOL_ROUNDS = 10;
    let toolRound = 0;

    while (
      result.requiresFunctionExecution &&
      result.functionCalls &&
      toolRound < MAX_TOOL_ROUNDS
    ) {
      toolRound++;

      // Execute all requested functions (favorites, word search, etc.)
      const functionResults = await Promise.all(
        result.functionCalls.map(async (call) => ({
          id: call.id,
          name: call.name,
          result: await executeFunction(
            req.user._id,
            call.name,
            call.arguments,
            req.session,
          ),
        })),
      );

      // Extract visualization HTML before passing results to AI
      // (avoids sending huge HTML strings to the model as tool results)
      const sanitizedResults = functionResults.map((fr) => {
        if (
          fr.name === "generate_visualization" &&
          fr.result.success &&
          fr.result.html
        ) {
          visualizationHtml = fr.result.html;
          return {
            ...fr,
            result: {
              success: true,
              bookTitle: fr.result.bookTitle,
              authors: fr.result.authors,
              message:
                "Interactive visualization has been generated and will be displayed to the user.",
            },
          };
        }
        return fr;
      });

      // Continue conversation with function results
      result = await aiService.continueAfterFunctionExecution(
        result.conversationHistory,
        result.assistantMessage,
        sanitizedResults,
      );

      if (result.error) {
        return res.status(500).json({
          error: result.error,
        });
      }
    }

    // Convert XML tags to HTML for rendering
    const htmlResponse = tagService.convertTagsToHTML(result.response);

    // Update conversation history in session
    conversationService.updateConversationHistory(
      req.session,
      result.conversationHistory,
    );

    // Trim history to prevent token limit issues
    conversationService.trimConversationHistory(
      req.session,
      config.conversation.maxHistoryMessages,
    );

    // Build response payload, including visualization if generated
    const responsePayload = {
      success: true,
      response: htmlResponse,
    };

    if (visualizationHtml) {
      responsePayload.visualization = visualizationHtml;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error("Error in chat controller:", error);
    res.status(500).json({
      error:
        "An error occurred while processing your message. Please try again.",
    });
  }
};

/**
 * Clear conversation history
 * @route POST /clear
 */
module.exports.clearHistory = (req, res) => {
  try {
    conversationService.clearConversationHistory(req.session);
    delete req.session.vizDataCache;

    res.json({
      success: true,
      message: "Conversation history cleared",
    });
  } catch (error) {
    console.error("Error clearing conversation history:", error);
    res.status(500).json({
      error: "Failed to clear conversation history",
    });
  }
};

/**
 * Get conversation statistics
 * @route GET /stats
 */
module.exports.getStats = (req, res) => {
  try {
    const stats = conversationService.getConversationStats(req.session);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting conversation stats:", error);
    res.status(500).json({
      error: "Failed to get conversation statistics",
    });
  }
};
