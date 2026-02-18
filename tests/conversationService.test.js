const {
  initializeConversation,
  getConversationHistory,
  updateConversationHistory,
  clearConversationHistory,
  getConversationStats,
  trimConversationHistory,
} = require("../services/conversationService");

function makeSession(history) {
  return history !== undefined ? { conversationHistory: history } : {};
}

describe("initializeConversation", () => {
  test("creates empty array on fresh session", () => {
    const session = {};
    const result = initializeConversation(session);
    expect(result).toEqual([]);
    expect(session.conversationHistory).toEqual([]);
  });

  test("preserves existing history", () => {
    const existing = [{ role: "user", content: "hi" }];
    const session = { conversationHistory: existing };
    const result = initializeConversation(session);
    expect(result).toBe(existing);
  });
});

describe("getConversationHistory", () => {
  test("returns history when present", () => {
    const msgs = [{ role: "user", content: "hello" }];
    expect(getConversationHistory(makeSession(msgs))).toBe(msgs);
  });

  test("returns empty array when no history exists", () => {
    expect(getConversationHistory({})).toEqual([]);
  });
});

describe("updateConversationHistory", () => {
  test("overwrites session history", () => {
    const session = makeSession([]);
    const newHistory = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ];
    updateConversationHistory(session, newHistory);
    expect(session.conversationHistory).toBe(newHistory);
  });
});

describe("clearConversationHistory", () => {
  test("resets to empty array", () => {
    const session = makeSession([{ role: "user", content: "old" }]);
    clearConversationHistory(session);
    expect(session.conversationHistory).toEqual([]);
  });
});

describe("getConversationStats", () => {
  test("counts user and assistant messages", () => {
    const session = makeSession([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ]);
    const stats = getConversationStats(session);
    expect(stats).toEqual({
      totalMessages: 3,
      userMessages: 2,
      assistantMessages: 1,
      conversationStarted: true,
    });
  });

  test("handles empty conversation", () => {
    const stats = getConversationStats(makeSession([]));
    expect(stats).toEqual({
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      conversationStarted: false,
    });
  });

  test("handles missing conversationHistory", () => {
    const stats = getConversationStats({});
    expect(stats.totalMessages).toBe(0);
    expect(stats.conversationStarted).toBe(false);
  });
});

describe("trimConversationHistory", () => {
  test("trims when history exceeds max pairs", () => {
    const msgs = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg-${i}`,
    }));
    const session = makeSession(msgs);
    trimConversationHistory(session, 5);
    expect(session.conversationHistory).toHaveLength(10);
    expect(session.conversationHistory[0].content).toBe("msg-20");
  });

  test("does not trim when within limit", () => {
    const msgs = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ];
    const session = makeSession(msgs);
    trimConversationHistory(session, 5);
    expect(session.conversationHistory).toHaveLength(2);
  });

  test("uses default maxMessages of 10", () => {
    const msgs = Array.from({ length: 24 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    const session = makeSession(msgs);
    trimConversationHistory(session);
    expect(session.conversationHistory).toHaveLength(20);
  });

  test("exactly at boundary does not trim", () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    const session = makeSession(msgs);
    trimConversationHistory(session, 5);
    expect(session.conversationHistory).toHaveLength(10);
  });
});
