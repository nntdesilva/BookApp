jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  }));
});

jest.mock("../services/aiService");
jest.mock("../services/tagService");
jest.mock("../services/conversationService");
jest.mock("../config/appConfig", () => ({
  claude: { apiKey: "test-key" },
  conversation: { maxHistoryMessages: 15 },
  redis: { url: "redis://localhost:6379" },
  services: {
    favoritesUrl: "http://localhost:3002",
    booksUrl: "http://localhost:3003",
    analysisUrl: "http://localhost:3004",
  },
}));

const express = require("express");
const request = require("supertest");

const chatRoutes = require("../routes/chatRoutes");
const aiService = require("../services/aiService");
const tagService = require("../services/tagService");
const conversationService = require("../services/conversationService");

const app = express();
app.use(express.json());
app.use("/api", chatRoutes);

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

describe("POST /api/chat", () => {
  test("returns 401 when no x-user-id header", async () => {
    const res = await request(app).post("/api/chat").send({ message: "hello" });
    expect(res.status).toBe(401);
  });

  test("returns 400 for missing message", async () => {
    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test("returns 400 for empty message", async () => {
    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "" });
    expect(res.status).toBe(400);
  });

  test("returns 400 for whitespace-only message", async () => {
    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "   " });
    expect(res.status).toBe(400);
  });

  test("returns 500 when API key is missing", async () => {
    const config = require("../config/appConfig");
    const origKey = config.claude.apiKey;
    config.claude.apiKey = null;

    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "hello" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/API key/i);
    config.claude.apiKey = origKey;
  });

  test("returns HTML response for simple text reply", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);
    aiService.runChatTurn.mockResolvedValue({
      success: true,
      response: "Hello there",
      conversationHistory: [],
      visualizationHtml: null,
    });
    tagService.convertTagsToHTML.mockReturnValue("<p>Hello there</p>");
    conversationService.updateConversationHistory.mockResolvedValue(undefined);
    conversationService.trimConversationHistory.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "hi" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.response).toBe("<p>Hello there</p>");
    expect(conversationService.updateConversationHistory).toHaveBeenCalled();
    expect(conversationService.trimConversationHistory).toHaveBeenCalled();
  });

  test("calls runChatTurn with message, history, and userId", async () => {
    const history = [{ role: "user", content: "prev" }];
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue(history);
    aiService.runChatTurn.mockResolvedValue({
      success: true,
      response: "ok",
      conversationHistory: [],
      visualizationHtml: null,
    });
    tagService.convertTagsToHTML.mockReturnValue("<p>ok</p>");
    conversationService.updateConversationHistory.mockResolvedValue(undefined);
    conversationService.trimConversationHistory.mockResolvedValue(undefined);

    await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "hello" });

    expect(aiService.runChatTurn).toHaveBeenCalledWith("hello", history, "user123");
  });

  test("returns 500 when AI service returns error", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);
    aiService.runChatTurn.mockResolvedValue({
      error: "Rate limit exceeded",
    });

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "hello" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Rate limit exceeded");
  });

  test("includes visualization HTML in response when present", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);
    aiService.runChatTurn.mockResolvedValue({
      success: true,
      response: "Here is the chart.",
      conversationHistory: [],
      visualizationHtml: "<html>chart</html>",
    });
    tagService.convertTagsToHTML.mockReturnValue("<p>Here is the chart.</p>");
    conversationService.updateConversationHistory.mockResolvedValue(undefined);
    conversationService.trimConversationHistory.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "visualize it" });

    expect(res.status).toBe(200);
    expect(res.body.visualization).toBe("<html>chart</html>");
    expect(res.body.success).toBe(true);
  });

  test("does not include visualization key when visualizationHtml is null", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);
    aiService.runChatTurn.mockResolvedValue({
      success: true,
      response: "No chart here.",
      conversationHistory: [],
      visualizationHtml: null,
    });
    tagService.convertTagsToHTML.mockReturnValue("<p>No chart here.</p>");
    conversationService.updateConversationHistory.mockResolvedValue(undefined);
    conversationService.trimConversationHistory.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "hello" });

    expect(res.status).toBe(200);
    expect(res.body.visualization).toBeUndefined();
  });

  test("returns 500 on unexpected exception", async () => {
    conversationService.initializeConversation.mockRejectedValue(new Error("unexpected"));

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "hello" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/error/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/clear
// ---------------------------------------------------------------------------

describe("POST /api/clear", () => {
  test("returns 401 without x-user-id", async () => {
    const res = await request(app).post("/api/clear").send();
    expect(res.status).toBe(401);
  });

  test("clears conversation history and returns success", async () => {
    conversationService.clearConversationHistory.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/clear")
      .set("x-user-id", "user123");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(conversationService.clearConversationHistory).toHaveBeenCalledWith("user123");
  });

  test("returns 500 on error", async () => {
    conversationService.clearConversationHistory.mockRejectedValue(new Error("Redis down"));

    const res = await request(app)
      .post("/api/clear")
      .set("x-user-id", "user123");

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/stats
// ---------------------------------------------------------------------------

describe("GET /api/stats", () => {
  test("returns 401 without x-user-id", async () => {
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(401);
  });

  test("returns conversation statistics", async () => {
    const stats = { totalMessages: 4, userMessages: 2, assistantMessages: 2, conversationStarted: true };
    conversationService.getConversationStats.mockResolvedValue(stats);

    const res = await request(app)
      .get("/api/stats")
      .set("x-user-id", "user123");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toEqual(stats);
  });

  test("returns 500 on error", async () => {
    conversationService.getConversationStats.mockRejectedValue(new Error("fail"));

    const res = await request(app)
      .get("/api/stats")
      .set("x-user-id", "user123");

    expect(res.status).toBe(500);
  });
});
