jest.mock("../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
}));

const redis = require("../config/redis");
const {
  initializeConversation,
  getConversationHistory,
  updateConversationHistory,
  clearConversationHistory,
  getConversationStats,
  trimConversationHistory,
} = require("../services/conversationService");

const CONV_TTL = 86400;

beforeEach(() => jest.clearAllMocks());

describe("initializeConversation", () => {
  test("creates empty array when no existing history", async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue("OK");

    await initializeConversation("user123");

    expect(redis.get).toHaveBeenCalledWith("conv:user123");
    expect(redis.set).toHaveBeenCalledWith(
      "conv:user123",
      JSON.stringify([]),
      "EX",
      CONV_TTL,
    );
  });

  test("does not overwrite existing history", async () => {
    redis.get.mockResolvedValue(JSON.stringify([{ role: "user", content: "hi" }]));

    await initializeConversation("user123");

    expect(redis.set).not.toHaveBeenCalled();
  });
});

describe("getConversationHistory", () => {
  test("returns parsed history when present", async () => {
    const msgs = [{ role: "user", content: "hello" }];
    redis.get.mockResolvedValue(JSON.stringify(msgs));

    const result = await getConversationHistory("user123");
    expect(result).toEqual(msgs);
  });

  test("returns empty array when no history exists", async () => {
    redis.get.mockResolvedValue(null);

    const result = await getConversationHistory("user123");
    expect(result).toEqual([]);
  });
});

describe("updateConversationHistory", () => {
  test("serializes and stores history in redis", async () => {
    redis.set.mockResolvedValue("OK");

    const newHistory = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ];

    await updateConversationHistory("user123", newHistory);

    expect(redis.set).toHaveBeenCalledWith(
      "conv:user123",
      JSON.stringify(newHistory),
      "EX",
      CONV_TTL,
    );
  });
});

describe("clearConversationHistory", () => {
  test("deletes the redis key", async () => {
    redis.del.mockResolvedValue(1);

    await clearConversationHistory("user123");

    expect(redis.del).toHaveBeenCalledWith("conv:user123");
  });
});

describe("getConversationStats", () => {
  test("counts user and assistant messages", async () => {
    const history = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ];
    redis.get.mockResolvedValue(JSON.stringify(history));

    const stats = await getConversationStats("user123");
    expect(stats).toEqual({
      totalMessages: 3,
      userMessages: 2,
      assistantMessages: 1,
      conversationStarted: true,
    });
  });

  test("handles empty conversation", async () => {
    redis.get.mockResolvedValue(JSON.stringify([]));

    const stats = await getConversationStats("user123");
    expect(stats).toEqual({
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      conversationStarted: false,
    });
  });

  test("handles null redis value", async () => {
    redis.get.mockResolvedValue(null);

    const stats = await getConversationStats("user123");
    expect(stats.totalMessages).toBe(0);
    expect(stats.conversationStarted).toBe(false);
  });
});

describe("trimConversationHistory", () => {
  test("trims when history exceeds max pairs", async () => {
    const msgs = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg-${i}`,
    }));
    redis.get.mockResolvedValue(JSON.stringify(msgs));
    redis.set.mockResolvedValue("OK");

    await trimConversationHistory("user123", 5);

    const setCall = redis.set.mock.calls[0];
    const stored = JSON.parse(setCall[1]);
    expect(stored).toHaveLength(10);
    expect(stored[0].content).toBe("msg-20");
  });

  test("does not trim when within limit", async () => {
    const msgs = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ];
    redis.get.mockResolvedValue(JSON.stringify(msgs));

    await trimConversationHistory("user123", 5);

    expect(redis.set).not.toHaveBeenCalled();
  });

  test("uses default maxMessages of 10", async () => {
    const msgs = Array.from({ length: 24 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    redis.get.mockResolvedValue(JSON.stringify(msgs));
    redis.set.mockResolvedValue("OK");

    await trimConversationHistory("user123");

    const stored = JSON.parse(redis.set.mock.calls[0][1]);
    expect(stored).toHaveLength(20);
  });

  test("exactly at boundary does not trim", async () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    redis.get.mockResolvedValue(JSON.stringify(msgs));

    await trimConversationHistory("user123", 5);

    expect(redis.set).not.toHaveBeenCalled();
  });
});
