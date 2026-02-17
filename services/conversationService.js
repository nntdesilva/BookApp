/**
 * Conversation Service - Handles conversation history and session management
 */

/**
 * Initialize conversation history in session
 * @param {Object} session - Express session object
 * @returns {Array} - Empty conversation history array
 */
function initializeConversation(session) {
  if (!session.conversationHistory) {
    session.conversationHistory = [];
  }
  return session.conversationHistory;
}

/**
 * Get conversation history from session
 * @param {Object} session - Express session object
 * @returns {Array} - Conversation history
 */
function getConversationHistory(session) {
  return session.conversationHistory || [];
}

/**
 * Update conversation history in session
 * @param {Object} session - Express session object
 * @param {Array} history - New conversation history
 */
function updateConversationHistory(session, history) {
  session.conversationHistory = history;
}

/**
 * Clear conversation history from session
 * @param {Object} session - Express session object
 */
function clearConversationHistory(session) {
  session.conversationHistory = [];
}

/**
 * Get conversation statistics
 * @param {Object} session - Express session object
 * @returns {Object} - Statistics about the conversation
 */
function getConversationStats(session) {
  const history = getConversationHistory(session);

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

/**
 * Trim conversation history to keep only recent messages
 * Useful to prevent token limit issues with very long conversations
 * @param {Object} session - Express session object
 * @param {number} maxMessages - Maximum number of message pairs to keep (default: 10)
 */
function trimConversationHistory(session, maxMessages = 10) {
  const history = getConversationHistory(session);

  if (history.length > maxMessages * 2) {
    // Keep only the last N message pairs (user + assistant)
    const trimmedHistory = history.slice(-(maxMessages * 2));
    updateConversationHistory(session, trimmedHistory);
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
