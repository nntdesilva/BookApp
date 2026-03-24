// Mock the ioredis client so the module loads without a real Redis connection.
jest.mock("../config/redis", () => ({
  on: jest.fn(),
}));

// Mock RedisChatMessageHistory so tests control getMessages / addMessages / clear
// without touching a real Redis instance.
const mockGetMessages = jest.fn();
const mockAddMessages = jest.fn();
const mockClear = jest.fn();

jest.mock("@langchain/community/stores/message/ioredis", () => ({
  RedisChatMessageHistory: jest.fn().mockImplementation(() => ({
    getMessages: mockGetMessages,
    addMessages: mockAddMessages,
    clear: mockClear,
  })),
}));

const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const {
  initializeConversation,
  getConversationHistory,
  updateConversationHistory,
  clearConversationHistory,
  getConversationStats,
  trimConversationHistory,
} = require("../services/conversationService");

beforeEach(() => {
  mockGetMessages.mockReset();
  mockAddMessages.mockReset();
  mockClear.mockReset();
});

describe("initializeConversation", () => {
  test("resolves without error (lazy-init handled by RedisChatMessageHistory)", async () => {
    await expect(initializeConversation("user123")).resolves.toBeUndefined();
  });
});

describe("getConversationHistory", () => {
  test("returns messages from RedisChatMessageHistory", async () => {
    const msgs = [new HumanMessage("hello"), new AIMessage("hi there")];
    mockGetMessages.mockResolvedValue(msgs);

    const result = await getConversationHistory("user123");
    expect(result).toEqual(msgs);
    expect(mockGetMessages).toHaveBeenCalledTimes(1);
  });

  test("returns empty array when no history exists", async () => {
    mockGetMessages.mockResolvedValue([]);

    const result = await getConversationHistory("user123");
    expect(result).toEqual([]);
  });
});

describe("updateConversationHistory", () => {
  test("clears then adds the full message set", async () => {
    mockClear.mockResolvedValue(undefined);
    mockAddMessages.mockResolvedValue(undefined);

    const msgs = [new HumanMessage("a"), new AIMessage("b")];
    await updateConversationHistory("user123", msgs);

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockAddMessages).toHaveBeenCalledWith(msgs);
  });

  test("clears but skips addMessages when given an empty array", async () => {
    mockClear.mockResolvedValue(undefined);

    await updateConversationHistory("user123", []);

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockAddMessages).not.toHaveBeenCalled();
  });
});

describe("clearConversationHistory", () => {
  test("delegates to history.clear()", async () => {
    mockClear.mockResolvedValue(undefined);

    await clearConversationHistory("user123");

    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});

describe("getConversationStats", () => {
  test("counts human and ai messages correctly", async () => {
    const msgs = [
      new HumanMessage("a"),
      new AIMessage("b"),
      new HumanMessage("c"),
    ];
    mockGetMessages.mockResolvedValue(msgs);

    const stats = await getConversationStats("user123");
    expect(stats).toEqual({
      totalMessages: 3,
      userMessages: 2,
      assistantMessages: 1,
      conversationStarted: true,
    });
  });

  test("handles empty conversation", async () => {
    mockGetMessages.mockResolvedValue([]);

    const stats = await getConversationStats("user123");
    expect(stats).toEqual({
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      conversationStarted: false,
    });
  });
});

describe("trimConversationHistory", () => {
  test("trims when history exceeds max pairs", async () => {
    const msgs = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0 ? new HumanMessage(`msg-${i}`) : new AIMessage(`msg-${i}`),
    );
    mockGetMessages.mockResolvedValue(msgs);
    mockClear.mockResolvedValue(undefined);
    mockAddMessages.mockResolvedValue(undefined);

    await trimConversationHistory("user123", 5);

    // Should keep the last 10 messages (5 pairs)
    const stored = mockAddMessages.mock.calls[0][0];
    expect(stored).toHaveLength(10);
    expect(stored[0].content).toBe("msg-20");
  });

  test("does not trim when within limit", async () => {
    const msgs = [new HumanMessage("a"), new AIMessage("b")];
    mockGetMessages.mockResolvedValue(msgs);

    await trimConversationHistory("user123", 5);

    expect(mockClear).not.toHaveBeenCalled();
    expect(mockAddMessages).not.toHaveBeenCalled();
  });

  test("uses default maxMessages of 10", async () => {
    const msgs = Array.from({ length: 24 }, (_, i) =>
      i % 2 === 0 ? new HumanMessage(`m${i}`) : new AIMessage(`m${i}`),
    );
    mockGetMessages.mockResolvedValue(msgs);
    mockClear.mockResolvedValue(undefined);
    mockAddMessages.mockResolvedValue(undefined);

    await trimConversationHistory("user123");

    const stored = mockAddMessages.mock.calls[0][0];
    expect(stored).toHaveLength(20);
  });

  test("exactly at boundary does not trim", async () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0 ? new HumanMessage(`m${i}`) : new AIMessage(`m${i}`),
    );
    mockGetMessages.mockResolvedValue(msgs);

    await trimConversationHistory("user123", 5);

    expect(mockClear).not.toHaveBeenCalled();
  });
});
