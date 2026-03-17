const express = require("express");
const aiService = require("../services/aiService");
const tagService = require("../services/tagService");
const conversationService = require("../services/conversationService");
const favoritesClient = require("../clients/favoritesClient");
const booksClient = require("../clients/booksClient");
const analysisClient = require("../clients/analysisClient");
const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "chatRoutes" });

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
  const t0 = Date.now();
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      logger.warn({ event: "chat_rejected", reason: "missing_user_id" });
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { message } = req.body;
    logger.info({ event: "chat_request", userId, messageLength: message ? String(message).length : 0 });

    const validation = validateMessage(message);
    if (!validation.valid) {
      logger.warn({ event: "chat_rejected", reason: "invalid_message", validationError: validation.error, userId });
      return res.status(400).json({ error: validation.error });
    }

    if (!config.claude.apiKey) {
      logger.error({ event: "chat_rejected", reason: "no_api_key" });
      return res.status(500).json({ error: "Claude API key is not configured." });
    }

    await conversationService.initializeConversation(userId);
    const history = await conversationService.getConversationHistory(userId);
    logger.info({ event: "history_loaded", userId, historyLength: history.length });

    let result = await aiService.generateChatResponse(message, history);

    if (result.error) {
      logger.error({ event: "claude_initial_call_failed", userId, error: result.error });
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
      const callNames = result.functionCalls.map((c) => c.name);
      logger.info({ event: "tool_round_start", userId, round: toolRound, maxRounds: MAX_TOOL_ROUNDS, functions: callNames });

      const functionResults = await Promise.all(
        result.functionCalls.map(async (call) => {
          const callT0 = Date.now();
          logger.info({ event: "function_executing", userId, functionName: call.name, args: call.arguments });
          const fnResult = await executeFunction(userId, call.name, call.arguments);
          logger.info({ event: "function_complete", userId, functionName: call.name, success: fnResult?.success ?? null, durationMs: Date.now() - callT0 });
          return { id: call.id, name: call.name, result: fnResult };
        }),
      );

      const sanitizedResults = functionResults.map((fr) => {
        if (
          fr.name === "generate_visualization" &&
          fr.result.success &&
          fr.result.html
        ) {
          visualizationHtml = fr.result.html;
          logger.info({ event: "visualization_generated", userId, bookTitle: fr.result.bookTitle, htmlLength: fr.result.html.length });
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
        logger.error({ event: "claude_continuation_failed", userId, toolRound, error: result.error });
        return res.status(500).json({ error: result.error });
      }
    }

    if (toolRound >= MAX_TOOL_ROUNDS) {
      logger.warn({ event: "max_tool_rounds_reached", userId, maxRounds: MAX_TOOL_ROUNDS });
    }

    logger.info({ event: "raw_ai_response_before_tag_conversion", userId, rawResponse: result.response });
    const htmlResponse = tagService.convertTagsToHTML(result.response);

    await conversationService.updateConversationHistory(
      userId,
      result.conversationHistory,
    );

    await conversationService.trimConversationHistory(
      userId,
      config.conversation.maxHistoryMessages,
    );

    const responsePayload = { success: true, response: htmlResponse };
    if (visualizationHtml) {
      responsePayload.visualization = visualizationHtml;
    }

    logger.info({ event: "chat_complete", userId, toolRounds: toolRound, hasVisualization: !!visualizationHtml, durationMs: Date.now() - t0 });
    res.json(responsePayload);
  } catch (error) {
    logger.error({ event: "chat_unexpected_error", userId: req.headers["x-user-id"], durationMs: Date.now() - t0, err: error });
    res.status(500).json({
      error: "An error occurred while processing your message. Please try again.",
    });
  }
});

router.post("/clear", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      logger.warn({ event: "clear_rejected", reason: "missing_user_id" });
      return res.status(401).json({ error: "Not authenticated" });
    }

    logger.info({ event: "clear_request", userId });
    await conversationService.clearConversationHistory(userId);
    logger.info({ event: "clear_success", userId });
    res.json({ success: true, message: "Conversation history cleared" });
  } catch (error) {
    logger.error({ event: "clear_error", userId: req.headers["x-user-id"], err: error });
    res.status(500).json({ error: "Failed to clear conversation history" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      logger.warn({ event: "stats_rejected", reason: "missing_user_id" });
      return res.status(401).json({ error: "Not authenticated" });
    }

    logger.info({ event: "stats_request", userId });
    const stats = await conversationService.getConversationStats(userId);
    logger.info({ event: "stats_success", userId, totalMessages: stats.totalMessages });
    res.json({ success: true, stats });
  } catch (error) {
    logger.error({ event: "stats_error", userId: req.headers["x-user-id"], err: error });
    res.status(500).json({ error: "Failed to get conversation statistics" });
  }
});

module.exports = router;
