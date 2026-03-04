const redis = require("../config/redis");

const CONV_TTL = 86400; // 24 hours

function redisKey(userId) {
  return `conv:${userId}`;
}

async function initializeConversation(userId) {
  const existing = await redis.get(redisKey(userId));
  if (!existing) {
    await redis.set(redisKey(userId), JSON.stringify([]), "EX", CONV_TTL);
  }
}

async function getConversationHistory(userId) {
  const raw = await redis.get(redisKey(userId));
  return raw ? JSON.parse(raw) : [];
}

async function updateConversationHistory(userId, history) {
  await redis.set(redisKey(userId), JSON.stringify(history), "EX", CONV_TTL);
}

async function clearConversationHistory(userId) {
  await redis.del(redisKey(userId));
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
    const trimmedHistory = history.slice(-(maxMessages * 2));
    await updateConversationHistory(userId, trimmedHistory);
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
