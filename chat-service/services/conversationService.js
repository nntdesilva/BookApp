const redis = require("../config/redis");
const logger = require("../config/logger").child({ component: "conversationService" });

const CONV_TTL = 86400; // 24 hours

function redisKey(userId) {
  return `conv:${userId}`;
}

async function initializeConversation(userId) {
  try {
    const existing = await redis.get(redisKey(userId));
    if (!existing) {
      await redis.set(redisKey(userId), JSON.stringify([]), "EX", CONV_TTL);
      logger.info({ event: "conversation_initialized", userId });
    }
  } catch (err) {
    logger.error({ event: "redis_error", operation: "initializeConversation", userId, err });
    throw err;
  }
}

async function getConversationHistory(userId) {
  try {
    const raw = await redis.get(redisKey(userId));
    const history = raw ? JSON.parse(raw) : [];
    if (!raw) {
      logger.warn({ event: "conversation_not_found", userId, msg: "no key in redis, returning empty history" });
    }
    return history;
  } catch (err) {
    logger.error({ event: "redis_error", operation: "getConversationHistory", userId, err });
    throw err;
  }
}

async function updateConversationHistory(userId, history) {
  try {
    await redis.set(redisKey(userId), JSON.stringify(history), "EX", CONV_TTL);
    logger.info({ event: "conversation_updated", userId, messageCount: history.length, ttl: CONV_TTL });
  } catch (err) {
    logger.error({ event: "redis_error", operation: "updateConversationHistory", userId, err });
    throw err;
  }
}

async function clearConversationHistory(userId) {
  try {
    await redis.del(redisKey(userId));
    logger.info({ event: "conversation_cleared", userId });
  } catch (err) {
    logger.error({ event: "redis_error", operation: "clearConversationHistory", userId, err });
    throw err;
  }
}

async function getConversationStats(userId) {
  const history = await getConversationHistory(userId);

  const userMessages = history.filter((msg) => msg.role === "user").length;
  const assistantMessages = history.filter(
    (msg) => msg.role === "assistant",
  ).length;

  return {
    totalMessages: history.length,
    userMessages,
    assistantMessages,
    conversationStarted: history.length > 0,
  };
}

async function trimConversationHistory(userId, maxMessages = 10) {
  const history = await getConversationHistory(userId);

  if (history.length > maxMessages * 2) {
    const before = history.length;
    const trimmedHistory = history.slice(-(maxMessages * 2));
    await updateConversationHistory(userId, trimmedHistory);
    logger.info({ event: "conversation_trimmed", userId, before, after: trimmedHistory.length, max: maxMessages * 2 });
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
