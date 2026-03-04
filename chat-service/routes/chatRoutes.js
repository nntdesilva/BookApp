const express = require("express");
const aiService = require("../services/aiService");
const tagService = require("../services/tagService");
const conversationService = require("../services/conversationService");
const favoritesClient = require("../clients/favoritesClient");
const booksClient = require("../clients/booksClient");
const analysisClient = require("../clients/analysisClient");
const config = require("../config/appConfig");

const router = express.Router();

function validateMessage(message) {
  if (!message) return { valid: false, error: "Message is required" };
  if (typeof message !== "string") return { valid: false, error: "Message must be a string" };
  if (message.trim() === "") return { valid: false, error: "Message cannot be empty" };
  if (message.length > 5000) return { valid: false, error: "Message is too long (max 5000 characters)" };
  return { valid: true };
}

async function executeFunction(userId, functionName, args) {
  switch (functionName) {
    case "add_to_favorites":
      return favoritesClient.addFavorite(userId, args.isbn13, args.title);

    case "remove_from_favorites":
      return favoritesClient.removeFavorite(userId, args.isbn13);

    case "list_favorites":
      return favoritesClient.listFavorites(userId);

    case "remove_all_favorites":
      return favoritesClient.clearFavorites(userId);

    case "resolve_book_for_search":
      return booksClient.resolveBookForSearch(args.bookTitle);

    case "count_word_in_book":
      return booksClient.countWordInBook(args.bookTitle, args.searchTerm);

    case "count_related_words_in_book":
      return booksClient.countRelatedWordsInBook(args.bookTitle, args.concept);

    case "analyze_book_statistics":
      return analysisClient.analyzeBookStatistics(args.bookTitle, args.question);

    case "generate_visualization":
      return analysisClient.generateVisualization(
        args.bookTitle,
        args.question,
        args.chartType,
      );

    default:
      return { success: false, message: `Unknown function: ${functionName}` };
  }
}

router.post("/chat", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { message } = req.body;

    const validation = validateMessage(message);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (!config.claude.apiKey) {
      return res.status(500).json({ error: "Claude API key is not configured." });
    }

    await conversationService.initializeConversation(userId);
    const history = await conversationService.getConversationHistory(userId);

    let result = await aiService.generateChatResponse(message, history);

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    let visualizationHtml = null;

    const MAX_TOOL_ROUNDS = 10;
    let toolRound = 0;

    while (
      result.requiresFunctionExecution &&
      result.functionCalls &&
      toolRound < MAX_TOOL_ROUNDS
    ) {
      toolRound++;

      const functionResults = await Promise.all(
        result.functionCalls.map(async (call) => ({
          id: call.id,
          name: call.name,
          result: await executeFunction(userId, call.name, call.arguments),
        })),
      );

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

      result = await aiService.continueAfterFunctionExecution(
        result.conversationHistory,
        result.assistantMessage,
        sanitizedResults,
      );

      if (result.error) {
        return res.status(500).json({ error: result.error });
      }
    }

    const htmlResponse = tagService.convertTagsToHTML(result.response);

    await conversationService.updateConversationHistory(
      userId,
      result.conversationHistory,
    );

    await conversationService.trimConversationHistory(
      userId,
      config.conversation.maxHistoryMessages,
    );

    const responsePayload = {
      success: true,
      response: htmlResponse,
    };

    if (visualizationHtml) {
      responsePayload.visualization = visualizationHtml;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error("[chat-service] Error in chat:", error);
    res.status(500).json({
      error: "An error occurred while processing your message. Please try again.",
    });
  }
});

router.post("/clear", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await conversationService.clearConversationHistory(userId);
    res.json({ success: true, message: "Conversation history cleared" });
  } catch (error) {
    console.error("[chat-service] Error clearing history:", error);
    res.status(500).json({ error: "Failed to clear conversation history" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const stats = await conversationService.getConversationStats(userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error("[chat-service] Error getting stats:", error);
    res.status(500).json({ error: "Failed to get conversation statistics" });
  }
});

module.exports = router;
