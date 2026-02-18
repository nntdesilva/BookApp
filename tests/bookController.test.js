jest.mock("../services/aiService");
jest.mock("../services/tagService");
jest.mock("../services/conversationService");
jest.mock("../services/favoriteService");
jest.mock("../services/gutenbergService");
jest.mock("../services/embeddingService");
jest.mock("../services/analysisService");
jest.mock("../utils/validators");
jest.mock("../config/appConfig", () => ({
  claude: { apiKey: "test-key" },
  conversation: { maxHistoryMessages: 15 },
  embedding: {
    apiKey: "test-embed-key",
    model: "text-embedding-3-large",
    similarityThreshold: 0.5,
    batchSize: 2048,
  },
  gutenberg: { apiBaseUrl: "https://gutendex.com" },
}));

const bookController = require("../controllers/bookController");
const aiService = require("../services/aiService");
const tagService = require("../services/tagService");
const conversationService = require("../services/conversationService");
const favoriteService = require("../services/favoriteService");
const gutenbergService = require("../services/gutenbergService");
const embeddingService = require("../services/embeddingService");
const analysisService = require("../services/analysisService");
const validators = require("../utils/validators");

function mockReq(overrides = {}) {
  return {
    body: {},
    session: {},
    user: { _id: "user123" },
    ...overrides,
  };
}

function mockRes() {
  const res = {
    render: jest.fn(),
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// --- index ---

describe("index", () => {
  test("clears history, deletes viz cache, and renders", () => {
    const req = mockReq({ session: { vizDataCache: { key: "x" } } });
    const res = mockRes();

    bookController.index(req, res);

    expect(conversationService.clearConversationHistory).toHaveBeenCalledWith(
      req.session,
    );
    expect(req.session.vizDataCache).toBeUndefined();
    expect(res.render).toHaveBeenCalledWith("books/index", { error: null });
  });
});

// --- clearHistory ---

describe("clearHistory", () => {
  test("clears history and returns success", () => {
    const req = mockReq({ session: { vizDataCache: "data" } });
    const res = mockRes();

    bookController.clearHistory(req, res);

    expect(conversationService.clearConversationHistory).toHaveBeenCalled();
    expect(req.session.vizDataCache).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Conversation history cleared",
    });
  });

  test("returns 500 on error", () => {
    conversationService.clearConversationHistory.mockImplementation(() => {
      throw new Error("Session error");
    });

    const req = mockReq();
    const res = mockRes();

    bookController.clearHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});

// --- getStats ---

describe("getStats", () => {
  test("returns conversation stats", () => {
    const stats = { totalMessages: 4, userMessages: 2, assistantMessages: 2 };
    conversationService.getConversationStats.mockReturnValue(stats);

    const req = mockReq();
    const res = mockRes();

    bookController.getStats(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, stats });
  });

  test("returns 500 on error", () => {
    conversationService.getConversationStats.mockImplementation(() => {
      throw new Error("fail");
    });

    const req = mockReq();
    const res = mockRes();

    bookController.getStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// --- chat ---

describe("chat", () => {
  test("returns 400 for invalid message", async () => {
    validators.validateMessage.mockReturnValue({
      valid: false,
      error: "Message is required",
    });

    const req = mockReq({ body: { message: "" } });
    const res = mockRes();

    await bookController.chat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Message is required" });
  });

  test("returns 500 when API key is missing", async () => {
    validators.validateMessage.mockReturnValue({ valid: true });

    // Temporarily override the mock
    const appConfig = require("../config/appConfig");
    const origKey = appConfig.claude.apiKey;
    appConfig.claude.apiKey = null;

    const req = mockReq({ body: { message: "hello" } });
    const res = mockRes();

    await bookController.chat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("API key") }),
    );

    appConfig.claude.apiKey = origKey;
  });

  test("returns HTML response for simple text reply", async () => {
    validators.validateMessage.mockReturnValue({ valid: true });
    conversationService.initializeConversation.mockReturnValue([]);
    conversationService.getConversationHistory.mockReturnValue([]);
    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      response: "Hello there",
      conversationHistory: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "Hello there" },
      ],
    });
    tagService.convertTagsToHTML.mockReturnValue("<p>Hello there</p>");

    const req = mockReq({ body: { message: "hi" } });
    const res = mockRes();

    await bookController.chat(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      response: "<p>Hello there</p>",
    });
    expect(conversationService.updateConversationHistory).toHaveBeenCalled();
    expect(conversationService.trimConversationHistory).toHaveBeenCalled();
  });

  test("returns 500 when AI service returns error", async () => {
    validators.validateMessage.mockReturnValue({ valid: true });
    conversationService.initializeConversation.mockReturnValue([]);
    conversationService.getConversationHistory.mockReturnValue([]);
    aiService.generateChatResponse.mockResolvedValue({
      error: "Rate limit exceeded",
    });

    const req = mockReq({ body: { message: "hello" } });
    const res = mockRes();

    await bookController.chat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Rate limit exceeded" });
  });

  test("executes tool calls and returns final response", async () => {
    validators.validateMessage.mockReturnValue({ valid: true });
    conversationService.initializeConversation.mockReturnValue([]);
    conversationService.getConversationHistory.mockReturnValue([]);

    // First call returns tool request
    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      requiresFunctionExecution: true,
      functionCalls: [
        {
          id: "t1",
          name: "list_favorites",
          arguments: {},
        },
      ],
      assistantMessage: { content: [{ type: "tool_use", id: "t1", name: "list_favorites", input: {} }] },
      conversationHistory: [{ role: "user", content: "list my favorites" }],
    });

    favoriteService.listFavorites.mockResolvedValue({
      success: true,
      favorites: [],
      count: 0,
    });

    // Continuation returns final text
    aiService.continueAfterFunctionExecution.mockResolvedValue({
      success: true,
      response: "Your favorites list is empty.",
      conversationHistory: [],
    });

    tagService.convertTagsToHTML.mockReturnValue(
      "<p>Your favorites list is empty.</p>",
    );

    const req = mockReq({ body: { message: "list my favorites" } });
    const res = mockRes();

    await bookController.chat(req, res);

    expect(aiService.continueAfterFunctionExecution).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      response: "<p>Your favorites list is empty.</p>",
    });
  });

  test("includes visualization HTML when generate_visualization is called", async () => {
    validators.validateMessage.mockReturnValue({ valid: true });
    conversationService.initializeConversation.mockReturnValue([]);
    conversationService.getConversationHistory.mockReturnValue([]);

    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      requiresFunctionExecution: true,
      functionCalls: [
        {
          id: "t1",
          name: "generate_visualization",
          arguments: { bookTitle: "Book", question: "q", chartType: "bar" },
        },
      ],
      assistantMessage: { content: [] },
      conversationHistory: [],
    });

    analysisService.analyzeBookStatistics.mockResolvedValue({
      success: true,
      answer: "data",
      bookTitle: "Book",
      authors: ["Author"],
    });

    analysisService.generateVisualization.mockResolvedValue({
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

    const req = mockReq({ body: { message: "visualize it" } });
    const res = mockRes();

    await bookController.chat(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.visualization).toBe("<html>chart</html>");
    expect(payload.success).toBe(true);
  });

  test("handles multiple rounds of tool calls", async () => {
    validators.validateMessage.mockReturnValue({ valid: true });
    conversationService.initializeConversation.mockReturnValue([]);
    conversationService.getConversationHistory.mockReturnValue([]);

    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      requiresFunctionExecution: true,
      functionCalls: [{ id: "t1", name: "resolve_book_for_search", arguments: { bookTitle: "Pride" } }],
      assistantMessage: { content: [] },
      conversationHistory: [],
    });

    gutenbergService.resolveBookForSearch.mockResolvedValue({
      available: true,
      title: "Pride and Prejudice",
    });

    // First continuation returns ANOTHER tool call
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

    gutenbergService.countWordInBook.mockResolvedValue({
      success: true,
      count: 45,
    });

    tagService.convertTagsToHTML.mockReturnValue("<p>45 times</p>");

    const req = mockReq({ body: { message: "count love in Pride" } });
    const res = mockRes();

    await bookController.chat(req, res);

    expect(aiService.continueAfterFunctionExecution).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalled();
  });

  test("returns 500 on unexpected exception", async () => {
    validators.validateMessage.mockReturnValue({ valid: true });
    conversationService.initializeConversation.mockImplementation(() => {
      throw new Error("unexpected");
    });

    const req = mockReq({ body: { message: "hello" } });
    const res = mockRes();

    await bookController.chat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("error") }),
    );
  });

  test("returns 500 when continuation returns error", async () => {
    validators.validateMessage.mockReturnValue({ valid: true });
    conversationService.initializeConversation.mockReturnValue([]);
    conversationService.getConversationHistory.mockReturnValue([]);

    aiService.generateChatResponse.mockResolvedValue({
      success: true,
      requiresFunctionExecution: true,
      functionCalls: [{ id: "t1", name: "list_favorites", arguments: {} }],
      assistantMessage: { content: [] },
      conversationHistory: [],
    });

    favoriteService.listFavorites.mockResolvedValue({ success: true, favorites: [] });

    aiService.continueAfterFunctionExecution.mockResolvedValue({
      error: "Token limit reached",
    });

    const req = mockReq({ body: { message: "list" } });
    const res = mockRes();

    await bookController.chat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Token limit reached" });
  });
});
