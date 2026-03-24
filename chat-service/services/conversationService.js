const { RedisChatMessageHistory } = require("@langchain/community/stores/message/ioredis");
const redis = require("../config/redis");
const logger = require("../config/logger").child({ component: "conversationService" });

const CONV_TTL = 86400; // 24 hours

function getHistory(userId) {
  return new RedisChatMessageHistory({
    sessionId: `conv:${userId}`,
    client: redis,
    ttl: CONV_TTL,
  });
}

// RedisChatMessageHistory handles lazy initialisation — no pre-seeding required.
async function initializeConversation(userId) {
  logger.info({ event: "conversation_initialized", userId });
}

async function getConversationHistory(userId) {
  try {
    const messages = await getHistory(userId).getMessages();
    return messages;
  } catch (err) {
    logger.error({ event: "redis_error", operation: "getConversationHistory", userId, err });
    throw err;
  }
}

// Full overwrite: clear existing messages then append the new set.
async function updateConversationHistory(userId, messages) {
  try {
    const history = getHistory(userId);
    await history.clear();
    if (messages.length > 0) {
      await history.addMessages(messages);
    }
    logger.info({ event: "conversation_updated", userId, messageCount: messages.length, ttl: CONV_TTL });
  } catch (err) {
    logger.error({ event: "redis_error", operation: "updateConversationHistory", userId, err });
    throw err;
  }
}

async function clearConversationHistory(userId) {
  try {
    await getHistory(userId).clear();
    logger.info({ event: "conversation_cleared", userId });
  } catch (err) {
    logger.error({ event: "redis_error", operation: "clearConversationHistory", userId, err });
    throw err;
  }
}

async function getConversationStats(userId) {
  const messages = await getConversationHistory(userId);

  const userMessages = messages.filter((m) => m._getType() === "human").length;
  const assistantMessages = messages.filter((m) => m._getType() === "ai").length;

  return {
    totalMessages: messages.length,
    userMessages,
    assistantMessages,
    conversationStarted: messages.length > 0,
  };
}

async function trimConversationHistory(userId, maxMessages = 10) {
  const messages = await getConversationHistory(userId);

  if (messages.length > maxMessages * 2) {
    const before = messages.length;
    const trimmed = messages.slice(-(maxMessages * 2));
    await updateConversationHistory(userId, trimmed);
    logger.info({ event: "conversation_trimmed", userId, before, after: trimmed.length, max: maxMessages * 2 });
  }
}

module.exports = {
  initializeConversation,
  getConversationHistory,
  updateConversationHistory,
  clearConversationHistory,
  getConversationStats,
  trimConversationHistory,
};
