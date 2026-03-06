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
jest.mock("../clients/favoritesClient");
jest.mock("../clients/booksClient");
jest.mock("../clients/analysisClient");
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
const favoritesClient = require("../clients/favoritesClient");
const booksClient = require("../clients/booksClient");
const analysisClient = require("../clients/analysisClient");

const app = express();
app.use(express.json());
app.use("/api", chatRoutes);

beforeEach(() => jest.clearAllMocks());

// --- POST /api/chat ---

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
    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      response: "Hello there",
      conversationHistory: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "Hello there" },
      ],
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

  test("returns 500 when AI service returns error", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);
    aiService.generateChatResponse.mockResolvedValue({
      error: "Rate limit exceeded",
    });

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "hello" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Rate limit exceeded");
  });

  test("executes tool calls via HTTP clients and returns final response", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);
    conversationService.updateConversationHistory.mockResolvedValue(undefined);
    conversationService.trimConversationHistory.mockResolvedValue(undefined);

    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      requiresFunctionExecution: true,
      functionCalls: [{ id: "t1", name: "list_favorites", arguments: {} }],
      assistantMessage: { content: [{ type: "tool_use", id: "t1", name: "list_favorites", input: {} }] },
      conversationHistory: [{ role: "user", content: "list my favorites" }],
    });

    favoritesClient.listFavorites.mockResolvedValue({
      success: true,
      favorites: [],
      count: 0,
    });

    aiService.continueAfterFunctionExecution.mockResolvedValue({
      success: true,
      response: "Your favorites list is empty.",
      conversationHistory: [],
    });

    tagService.convertTagsToHTML.mockReturnValue("<p>Your favorites list is empty.</p>");

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "list my favorites" });

    expect(res.status).toBe(200);
    expect(favoritesClient.listFavorites).toHaveBeenCalledWith("user123");
    expect(aiService.continueAfterFunctionExecution).toHaveBeenCalled();
    expect(res.body.response).toBe("<p>Your favorites list is empty.</p>");
  });

  test("includes visualization HTML when generate_visualization is called", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);
    conversationService.updateConversationHistory.mockResolvedValue(undefined);
    conversationService.trimConversationHistory.mockResolvedValue(undefined);

    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      requiresFunctionExecution: true,
      functionCalls: [
        { id: "t1", name: "generate_visualization", arguments: { bookTitle: "Book", question: "q", chartType: "bar" } },
      ],
      assistantMessage: { content: [] },
      conversationHistory: [],
    });

    analysisClient.generateVisualization.mockResolvedValue({
      success: true,
      html: "<html>chart</html>",
      bookTitle: "Book",
      authors: ["Author"],
    });

    aiService.continueAfterFunctionExecution.mockResolvedValue({
      success: true,
      response: "Here is the chart.",
      conversationHistory: [],
    });

    tagService.convertTagsToHTML.mockReturnValue("<p>Here is the chart.</p>");

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "visualize it" });

    expect(res.status).toBe(200);
    expect(res.body.visualization).toBe("<html>chart</html>");
    expect(res.body.success).toBe(true);
  });

  test("handles multiple rounds of tool calls", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);
    conversationService.updateConversationHistory.mockResolvedValue(undefined);
    conversationService.trimConversationHistory.mockResolvedValue(undefined);

    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      requiresFunctionExecution: true,
      functionCalls: [{ id: "t1", name: "resolve_book_for_search", arguments: { bookTitle: "Pride" } }],
      assistantMessage: { content: [] },
      conversationHistory: [],
    });

    booksClient.resolveBookForSearch.mockResolvedValue({
      available: true,
      title: "Pride and Prejudice",
    });

    aiService.continueAfterFunctionExecution
      .mockResolvedValueOnce({
        success: true,
        requiresFunctionExecution: true,
        functionCalls: [{ id: "t2", name: "count_word_in_book", arguments: { bookTitle: "Pride", searchTerm: "love" } }],
        assistantMessage: { content: [] },
        conversationHistory: [],
      })
      .mockResolvedValueOnce({
        success: true,
        response: "The word love appears 45 times.",
        conversationHistory: [],
      });

    booksClient.countWordInBook.mockResolvedValue({ success: true, count: 45 });
    tagService.convertTagsToHTML.mockReturnValue("<p>45 times</p>");

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "count love in Pride" });

    expect(res.status).toBe(200);
    expect(aiService.continueAfterFunctionExecution).toHaveBeenCalledTimes(2);
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

  test("returns 500 when continuation returns error", async () => {
    conversationService.initializeConversation.mockResolvedValue(undefined);
    conversationService.getConversationHistory.mockResolvedValue([]);

    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      requiresFunctionExecution: true,
      functionCalls: [{ id: "t1", name: "list_favorites", arguments: {} }],
      assistantMessage: { content: [] },
      conversationHistory: [],
    });

    favoritesClient.listFavorites.mockResolvedValue({ success: true, favorites: [] });

    aiService.continueAfterFunctionExecution.mockResolvedValue({
      error: "Token limit reached",
    });

    const res = await request(app)
      .post("/api/chat")
      .set("x-user-id", "user123")
      .send({ message: "list" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Token limit reached");
  });
});

// --- POST /api/clear ---

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

// --- GET /api/stats ---

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
