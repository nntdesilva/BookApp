/**
 * Book Controller - Handles HTTP requests and responses for book-related operations
 */

const aiService = require("../services/aiService");
const tagService = require("../services/tagService");
const conversationService = require("../services/conversationService");
const favoriteService = require("../services/favoriteService");
const validators = require("../utils/validators");
const config = require("../config/appConfig");

/**
 * Render the main books index page
 * @route GET /
 */
module.exports.index = (req, res) => {
  // Initialize conversation history for new sessions
  conversationService.initializeConversation(req.session);

  // Clear favorites list on page refresh
  favoriteService.clearFavorites(req.session);

  res.render("books/index", {
    error: null,
  });
};

/**
 * Execute a favorite function and return the result
 * @param {Object} session - Express session object
 * @param {string} functionName - Name of the function to execute
 * @param {Object} args - Function arguments
 * @returns {Object} - Function execution result
 */
function executeFavoriteFunction(session, functionName, args) {
  // Initialize favorites in session
  favoriteService.initializeFavorites(session);

  switch (functionName) {
    case "add_to_favorites": {
      // Normalize ISBN (remove hyphens/spaces)
      const normalizedIsbn = favoriteService.normalizeIsbn13(args.isbn13);
      return favoriteService.addFavorite(session, normalizedIsbn, args.title);
    }
    case "remove_from_favorites": {
      const normalizedIsbn = favoriteService.normalizeIsbn13(args.isbn13);
      return favoriteService.removeFavorite(session, normalizedIsbn);
    }
    case "list_favorites": {
      return favoriteService.listFavorites(session);
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
    if (!config.openai.apiKey) {
      return res.status(500).json({
        error: "OpenAI API key is not configured.",
      });
    }

    // Initialize conversation history and favorites if needed
    conversationService.initializeConversation(req.session);
    favoriteService.initializeFavorites(req.session);

    // Get current conversation history
    const history = conversationService.getConversationHistory(req.session);

    // Generate AI response using the AI service
    let result = await aiService.generateChatResponse(message, history);

    if (result.error) {
      return res.status(500).json({
        error: result.error,
      });
    }

    // Check if AI wants to execute functions
    if (result.requiresFunctionExecution && result.functionCalls) {
      // Execute all requested functions
      const functionResults = result.functionCalls.map((call) => ({
        id: call.id,
        name: call.name,
        result: executeFavoriteFunction(req.session, call.name, call.arguments),
      }));

      // Continue conversation with function results
      result = await aiService.continueAfterFunctionExecution(
        result.conversationHistory,
        result.assistantMessage,
        functionResults
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
      result.conversationHistory
    );

    // Trim history to prevent token limit issues
    conversationService.trimConversationHistory(
      req.session,
      config.conversation.maxHistoryMessages
    );

    res.json({
      success: true,
      response: htmlResponse,
    });
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
