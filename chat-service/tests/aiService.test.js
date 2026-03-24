// Mock @langchain/langgraph/prebuilt so no real agent or API calls are made.
// createReactAgent returns a fake agent object whose invoke() is the shared
// mockAgentInvoke spy. The spy is exposed via __mockAgentInvoke so each test
// can configure exactly what the agent returns.
const mockAgentInvoke = jest.fn();
jest.mock("@langchain/langgraph/prebuilt", () => ({
  createReactAgent: jest.fn().mockReturnValue({ invoke: mockAgentInvoke }),
}));

jest.mock("@langchain/anthropic", () => {
  const MockChatAnthropic = jest.fn().mockImplementation(() => ({}));
  return { ChatAnthropic: MockChatAnthropic };
});

jest.mock("../config/appConfig", () => ({
  claude: {
    apiKey: "test-api-key",
    model: "claude-sonnet-4-5",
    temperature: 0.7,
    maxTokens: 1000,
  },
}));

jest.mock("../clients/favoritesClient", () => ({
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
  listFavorites: jest.fn(),
  clearFavorites: jest.fn(),
}));

jest.mock("../clients/booksClient", () => ({
  countWordInBook: jest.fn(),
  countRelatedWordsInBook: jest.fn(),
}));

jest.mock("../clients/analysisClient", () => ({
  analyzeBookStatistics: jest.fn(),
  generateVisualization: jest.fn(),
}));

const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const favoritesClient = require("../clients/favoritesClient");
const booksClient = require("../clients/booksClient");
const analysisClient = require("../clients/analysisClient");

// Must require AFTER all mocks are set up.
const { runChatTurn, createTools } = require("../services/aiService");

beforeEach(() => {
  mockAgentInvoke.mockReset();
  jest.clearAllMocks();
  // Restore API key which error tests may blank out.
  require("../config/appConfig").claude.apiKey = "test-api-key";
});

// ---------------------------------------------------------------------------
// runChatTurn
// ---------------------------------------------------------------------------

describe("runChatTurn", () => {
  describe("happy path", () => {
    test("returns text response for a simple message", async () => {
      mockAgentInvoke.mockResolvedValue({
        messages: [
          new HumanMessage("Hello"),
          new AIMessage("Hi there! How can I help?"),
        ],
      });

      const result = await runChatTurn("Hello", [], "user1");

      expect(result.success).toBe(true);
      expect(result.response).toBe("Hi there! How can I help?");
      expect(result.visualizationHtml).toBeNull();
    });

    test("appends HumanMessage and final AIMessage to conversation history", async () => {
      const existingHistory = [
        new HumanMessage("first question"),
        new AIMessage("first answer"),
      ];

      mockAgentInvoke.mockResolvedValue({
        messages: [
          ...existingHistory,
          new HumanMessage("second question"),
          new AIMessage("second answer"),
        ],
      });

      const result = await runChatTurn("second question", existingHistory, "user1");

      expect(result.conversationHistory).toHaveLength(4);
      expect(result.conversationHistory[2]).toBeInstanceOf(HumanMessage);
      expect(result.conversationHistory[2].content).toBe("second question");
      expect(result.conversationHistory[3]).toBeInstanceOf(AIMessage);
      expect(result.conversationHistory[3].content).toBe("second answer");
    });

    test("passes full history + new message to the agent", async () => {
      const history = [
        new HumanMessage("prev"),
        new AIMessage("prev response"),
      ];

      mockAgentInvoke.mockResolvedValue({
        messages: [...history, new HumanMessage("new"), new AIMessage("ok")],
      });

      await runChatTurn("new", history, "user42");

      const [{ messages }] = mockAgentInvoke.mock.calls[0];
      expect(messages).toHaveLength(3); // 2 history + 1 new HumanMessage
      expect(messages[messages.length - 1]).toBeInstanceOf(HumanMessage);
      expect(messages[messages.length - 1].content).toBe("new");
    });

    test("handles content that is an array of text blocks", async () => {
      mockAgentInvoke.mockResolvedValue({
        messages: [
          new HumanMessage("hi"),
          new AIMessage({ content: [{ type: "text", text: "Part A" }, { type: "text", text: "Part B" }] }),
        ],
      });

      const result = await runChatTurn("hi", [], "user1");

      expect(result.response).toBe("Part A\nPart B");
    });

    test("uses empty array as default conversation history", async () => {
      mockAgentInvoke.mockResolvedValue({
        messages: [new HumanMessage("hello"), new AIMessage("hey")],
      });

      const result = await runChatTurn("hello", undefined, "user1");
      expect(result.success).toBe(true);
    });

    test("returns null visualizationHtml when no visualization tool was called", async () => {
      mockAgentInvoke.mockResolvedValue({
        messages: [new HumanMessage("tell me about Hamlet"), new AIMessage("Hamlet is a play...")],
      });

      const result = await runChatTurn("tell me about Hamlet", [], "user1");
      expect(result.visualizationHtml).toBeNull();
    });
  });

  describe("error scenarios", () => {
    test("returns error for null message", async () => {
      const result = await runChatTurn(null, [], "user1");
      expect(result.error).toMatch(/Invalid message format/);
    });

    test("returns error for empty string message", async () => {
      const result = await runChatTurn("", [], "user1");
      expect(result.error).toMatch(/Invalid message format/);
    });

    test("returns error for non-string message", async () => {
      const result = await runChatTurn(42, [], "user1");
      expect(result.error).toMatch(/Invalid message format/);
    });

    test("returns error when API key is missing", async () => {
      require("../config/appConfig").claude.apiKey = null;

      const result = await runChatTurn("hello", [], "user1");
      expect(result.error).toMatch(/API key is not configured/);
    });

    test("returns error when agent throws", async () => {
      mockAgentInvoke.mockRejectedValue(new Error("Rate limit exceeded"));

      const result = await runChatTurn("hello", [], "user1");
      expect(result.error).toBe("Rate limit exceeded");
    });

    test("falls back to generic message when error has no .message", async () => {
      mockAgentInvoke.mockRejectedValue({});

      const result = await runChatTurn("hello", [], "user1");
      expect(result.error).toBe("Failed to generate response. Please try again.");
    });

    test("handles network timeout error from agent", async () => {
      mockAgentInvoke.mockRejectedValue(new Error("Request timed out"));

      const result = await runChatTurn("hello", [], "user1");
      expect(result.error).toBe("Request timed out");
    });
  });
});

// ---------------------------------------------------------------------------
// createTools — tool implementations
// ---------------------------------------------------------------------------

describe("createTools", () => {
  const USER_ID = "test-user-99";

  describe("add_to_favorites", () => {
    test("calls favoritesClient.addFavorite with correct args", async () => {
      favoritesClient.addFavorite.mockResolvedValue({ success: true });
      const { tools } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "add_to_favorites");

      await t.invoke({ isbn13: "9780140449136", title: "The Brothers Karamazov" });

      expect(favoritesClient.addFavorite).toHaveBeenCalledWith(
        USER_ID,
        "9780140449136",
        "The Brothers Karamazov",
      );
    });

    test("returns JSON-stringified client response", async () => {
      favoritesClient.addFavorite.mockResolvedValue({ success: true, message: "Added" });
      const { tools } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "add_to_favorites");

      const output = await t.invoke({ isbn13: "9780000000000", title: "Book" });
      expect(JSON.parse(output)).toEqual({ success: true, message: "Added" });
    });
  });

  describe("remove_from_favorites", () => {
    test("calls favoritesClient.removeFavorite with correct args", async () => {
      favoritesClient.removeFavorite.mockResolvedValue({ success: true });
      const { tools } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "remove_from_favorites");

      await t.invoke({ isbn13: "9780140449136" });

      expect(favoritesClient.removeFavorite).toHaveBeenCalledWith(USER_ID, "9780140449136");
    });
  });

  describe("list_favorites", () => {
    test("calls favoritesClient.listFavorites for correct user", async () => {
      favoritesClient.listFavorites.mockResolvedValue({ favorites: [] });
      const { tools } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "list_favorites");

      await t.invoke({});

      expect(favoritesClient.listFavorites).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe("remove_all_favorites", () => {
    test("calls favoritesClient.clearFavorites for correct user", async () => {
      favoritesClient.clearFavorites.mockResolvedValue({ success: true });
      const { tools } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "remove_all_favorites");

      await t.invoke({});

      expect(favoritesClient.clearFavorites).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe("count_word_in_book", () => {
    test("calls booksClient.countWordInBook with correct args", async () => {
      booksClient.countWordInBook.mockResolvedValue({ count: 42 });
      const { tools } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "count_word_in_book");

      await t.invoke({ bookTitle: "Hamlet", searchTerm: "love" });

      expect(booksClient.countWordInBook).toHaveBeenCalledWith("Hamlet", "love");
    });
  });

  describe("count_related_words_in_book", () => {
    test("calls booksClient.countRelatedWordsInBook with correct args", async () => {
      booksClient.countRelatedWordsInBook.mockResolvedValue({ words: [] });
      const { tools } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "count_related_words_in_book");

      await t.invoke({ bookTitle: "Hamlet", concept: "emotions" });

      expect(booksClient.countRelatedWordsInBook).toHaveBeenCalledWith("Hamlet", "emotions");
    });
  });

  describe("analyze_book_statistics", () => {
    test("calls analysisClient.analyzeBookStatistics with correct args", async () => {
      analysisClient.analyzeBookStatistics.mockResolvedValue({ result: "done" });
      const { tools } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "analyze_book_statistics");

      await t.invoke({ bookTitle: "Hamlet", question: "average sentence length?" });

      expect(analysisClient.analyzeBookStatistics).toHaveBeenCalledWith(
        "Hamlet",
        "average sentence length?",
      );
    });
  });

  describe("generate_visualization", () => {
    test("captures HTML and returns a stripped-down summary to the LLM", async () => {
      analysisClient.generateVisualization.mockResolvedValue({
        success: true,
        html: "<div>big chart html</div>",
        bookTitle: "Hamlet",
        authors: ["Shakespeare"],
      });

      const { tools, getVisualizationHtml } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "generate_visualization");

      const output = await t.invoke({
        bookTitle: "Hamlet",
        question: "top 10 words",
        chartType: "bar chart",
      });

      // HTML is captured on the side
      expect(getVisualizationHtml()).toBe("<div>big chart html</div>");

      // The LLM receives a small summary, NOT the full HTML
      const parsed = JSON.parse(output);
      expect(parsed.html).toBeUndefined();
      expect(parsed.message).toMatch(/visualization has been generated/i);
      expect(parsed.bookTitle).toBe("Hamlet");
    });

    test("returns raw client response when visualization fails", async () => {
      analysisClient.generateVisualization.mockResolvedValue({
        success: false,
        error: "Book not found",
      });

      const { tools, getVisualizationHtml } = createTools(USER_ID);
      const t = tools.find((t) => t.name === "generate_visualization");

      const output = await t.invoke({
        bookTitle: "Unknown Book",
        question: "word freq",
        chartType: "bar chart",
      });

      expect(getVisualizationHtml()).toBeNull();
      expect(JSON.parse(output)).toEqual({ success: false, error: "Book not found" });
    });

    test("each createTools call has its own independent HTML capture", async () => {
      analysisClient.generateVisualization.mockResolvedValue({
        success: true,
        html: "<div>chart</div>",
        bookTitle: "Hamlet",
        authors: [],
      });

      const { tools: tools1, getVisualizationHtml: getHtml1 } = createTools("userA");
      const { getVisualizationHtml: getHtml2 } = createTools("userB");

      const vizTool = tools1.find((t) => t.name === "generate_visualization");
      await vizTool.invoke({ bookTitle: "Hamlet", question: "q", chartType: "bar chart" });

      // userA's closure captured HTML; userB's closure is untouched
      expect(getHtml1()).toBe("<div>chart</div>");
      expect(getHtml2()).toBeNull();
    });
  });
});
