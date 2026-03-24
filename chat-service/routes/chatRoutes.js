const express = require("express");
const aiService = require("../services/aiService");
const tagService = require("../services/tagService");
const conversationService = require("../services/conversationService");
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

    const result = await aiService.runChatTurn(message, history, userId);

    if (result.error) {
      logger.error({ event: "agent_run_failed", userId, error: result.error });
      return res.status(500).json({ error: result.error });
    }

    const htmlResponse = tagService.convertTagsToHTML(result.response);

    await conversationService.updateConversationHistory(userId, result.conversationHistory);
    await conversationService.trimConversationHistory(userId, config.conversation.maxHistoryMessages);

    const responsePayload = { success: true, response: htmlResponse };
    if (result.visualizationHtml) {
      responsePayload.visualization = result.visualizationHtml;
    }

    logger.info({ event: "chat_complete", userId, hasVisualization: !!result.visualizationHtml, durationMs: Date.now() - t0 });
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
