// Mock @langchain/anthropic so no real API calls are made.
// bindTools() returns a bound model whose invoke() is the shared mockInvoke spy.
jest.mock("@langchain/anthropic", () => {
  const mockInvoke = jest.fn();
  const mockBoundModel = { invoke: mockInvoke };
  const MockChatAnthropic = jest.fn().mockImplementation(() => ({
    bindTools: jest.fn().mockReturnValue(mockBoundModel),
  }));
  MockChatAnthropic.__mockInvoke = mockInvoke;
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

const { ChatAnthropic } = require("@langchain/anthropic");
const { HumanMessage, AIMessage, ToolMessage } = require("@langchain/core/messages");

let mockInvoke;

beforeEach(() => {
  mockInvoke = ChatAnthropic.__mockInvoke;
  mockInvoke.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-api-key";
});

const {
  generateChatResponse,
  continueAfterFunctionExecution,
} = require("../services/aiService");

// ---------------------------------------------------------------------------
// generateChatResponse
// ---------------------------------------------------------------------------

describe("generateChatResponse", () => {
  describe("happy path", () => {
    test("returns text response for non-tool messages", async () => {
      mockInvoke.mockResolvedValue({
        content: [{ type: "text", text: "Hello! How can I help?" }],
        tool_calls: [],
      });

      const result = await generateChatResponse("Hi", []);
      expect(result.success).toBe(true);
      expect(result.response).toBe("Hello! How can I help?");
      // history = [HumanMessage, AIMessage]
      expect(result.conversationHistory).toHaveLength(2);
      expect(result.conversationHistory[0]).toBeInstanceOf(HumanMessage);
      expect(result.conversationHistory[1].tool_calls).toBeDefined();
    });

    test("concatenates multiple text blocks", async () => {
      mockInvoke.mockResolvedValue({
        content: [
          { type: "text", text: "Part 1" },
          { type: "text", text: "Part 2" },
        ],
        tool_calls: [],
      });

      const result = await generateChatResponse("Hello", []);
      expect(result.response).toBe("Part 1\nPart 2");
    });

    test("returns tool calls when Claude wants to use tools", async () => {
      mockInvoke.mockResolvedValue({
        content: [
          { type: "text", text: "Let me check..." },
          {
            type: "tool_use",
            id: "tool_1",
            name: "add_to_favorites",
            input: { isbn13: "9780140449136", title: "Brothers K" },
          },
        ],
        tool_calls: [
          { id: "tool_1", name: "add_to_favorites", args: { isbn13: "9780140449136", title: "Brothers K" } },
        ],
      });

      const result = await generateChatResponse("Add this book", []);
      expect(result.success).toBe(true);
      expect(result.requiresFunctionExecution).toBe(true);
      expect(result.functionCalls).toHaveLength(1);
      expect(result.functionCalls[0]).toEqual({
        id: "tool_1",
        name: "add_to_favorites",
        arguments: { isbn13: "9780140449136", title: "Brothers K" },
      });
      expect(result.assistantMessage).toBeDefined();
    });

    test("passes conversation history to the model", async () => {
      const history = [
        new HumanMessage("first"),
        new AIMessage({ content: [{ type: "text", text: "response" }], tool_calls: [] }),
      ];

      mockInvoke.mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
        tool_calls: [],
      });

      await generateChatResponse("second", history);

      // The model receives [systemMsg, ...history, newHumanMessage]
      const callArgs = mockInvoke.mock.calls[0][0];
      expect(callArgs.length).toBe(4); // system + 2 history + new human
      expect(callArgs[callArgs.length - 1]).toBeInstanceOf(HumanMessage);
      expect(callArgs[callArgs.length - 1].content).toBe("second");
    });
  });

  describe("edge cases", () => {
    test("handles empty content array from LLM (malformed output)", async () => {
      mockInvoke.mockResolvedValue({ content: [], tool_calls: [] });

      const result = await generateChatResponse("test", []);
      expect(result.success).toBe(true);
      expect(result.response).toBe("");
    });

    test("handles response with only non-text/non-tool blocks", async () => {
      mockInvoke.mockResolvedValue({
        content: [{ type: "unknown_block", data: "something" }],
        tool_calls: [],
      });

      const result = await generateChatResponse("test", []);
      expect(result.success).toBe(true);
      expect(result.response).toBe("");
    });

    test("uses empty array as default conversation history", async () => {
      mockInvoke.mockResolvedValue({
        content: [{ type: "text", text: "hi" }],
        tool_calls: [],
      });

      const result = await generateChatResponse("hello");
      expect(result.success).toBe(true);
    });
  });

  describe("error scenarios", () => {
    test("returns error for null message", async () => {
      const result = await generateChatResponse(null, []);
      expect(result.error).toMatch(/Invalid message format/);
    });

    test("returns error for empty string message", async () => {
      const result = await generateChatResponse("", []);
      expect(result.error).toMatch(/Invalid message format/);
    });

    test("returns error for non-string message", async () => {
      const result = await generateChatResponse(42, []);
      expect(result.error).toMatch(/Invalid message format/);
    });

    test("returns error when ANTHROPIC_API_KEY is missing", async () => {
      const config = require("../config/appConfig");
      const origKey = config.claude.apiKey;
      config.claude.apiKey = null;
      const result = await generateChatResponse("hello", []);
      expect(result.error).toMatch(/API key is not configured/);
      config.claude.apiKey = origKey;
    });

    test("returns error on API exception", async () => {
      mockInvoke.mockRejectedValue(new Error("Rate limit exceeded"));

      const result = await generateChatResponse("hello", []);
      expect(result.error).toBe("Rate limit exceeded");
    });

    test("handles token limit / overloaded error", async () => {
      mockInvoke.mockRejectedValue(
        new Error(
          "This request would exceed the token limit. Please reduce your prompt.",
        ),
      );

      const result = await generateChatResponse("very long message", []);
      expect(result.error).toMatch(/token limit/i);
    });

    test("handles network timeout error", async () => {
      mockInvoke.mockRejectedValue(new Error("Request timed out"));

      const result = await generateChatResponse("hello", []);
      expect(result.error).toBe("Request timed out");
    });

    test("falls back to generic message when error has no message", async () => {
      mockInvoke.mockRejectedValue({});

      const result = await generateChatResponse("hello", []);
      expect(result.error).toBe(
        "Failed to generate response. Please try again.",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// continueAfterFunctionExecution
// ---------------------------------------------------------------------------

describe("continueAfterFunctionExecution", () => {
  describe("happy path", () => {
    test("returns final text response after tool execution", async () => {
      mockInvoke.mockResolvedValue({
        content: [
          { type: "text", text: "Done! I added the book to your favorites." },
        ],
        tool_calls: [],
      });

      const assistantMsg = new AIMessage({
        content: [
          { type: "text", text: "Let me add that." },
          { type: "tool_use", id: "t1", name: "add_to_favorites", input: {} },
        ],
        tool_calls: [{ id: "t1", name: "add_to_favorites", args: {} }],
      });

      const result = await continueAfterFunctionExecution(
        [new HumanMessage("add this book")],
        assistantMsg,
        [{ id: "t1", name: "add_to_favorites", result: { success: true } }],
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("added the book");
      expect(result.conversationHistory.length).toBeGreaterThan(0);
    });

    test("returns more tool calls when Claude chains tools", async () => {
      mockInvoke.mockResolvedValue({
        content: [
          {
            type: "tool_use",
            id: "t2",
            name: "count_word_in_book",
            input: { bookTitle: "Book", searchTerm: "love" },
          },
        ],
        tool_calls: [
          { id: "t2", name: "count_word_in_book", args: { bookTitle: "Book", searchTerm: "love" } },
        ],
      });

      const assistantMsg = new AIMessage({
        content: [
          { type: "tool_use", id: "t1", name: "resolve_book_for_search", input: {} },
        ],
        tool_calls: [{ id: "t1", name: "resolve_book_for_search", args: {} }],
      });

      const result = await continueAfterFunctionExecution(
        [],
        assistantMsg,
        [
          {
            id: "t1",
            name: "resolve_book_for_search",
            result: { available: true },
          },
        ],
      );

      expect(result.requiresFunctionExecution).toBe(true);
      expect(result.functionCalls).toHaveLength(1);
      expect(result.functionCalls[0].name).toBe("count_word_in_book");
    });
  });

  describe("edge cases", () => {
    test("handles empty text response from LLM", async () => {
      mockInvoke.mockResolvedValue({ content: [], tool_calls: [] });

      const assistantMsg = new AIMessage({
        content: [{ type: "tool_use", id: "t", name: "f", input: {} }],
        tool_calls: [{ id: "t", name: "f", args: {} }],
      });

      const result = await continueAfterFunctionExecution(
        [],
        assistantMsg,
        [{ id: "t", name: "f", result: {} }],
      );

      expect(result.success).toBe(true);
      expect(result.response).toBe("");
    });

    test("builds ToolMessage with correct tool_call_id", async () => {
      mockInvoke.mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
        tool_calls: [],
      });

      const assistantMsg = new AIMessage({
        content: [{ type: "tool_use", id: "t1", name: "f", input: {} }],
        tool_calls: [{ id: "t1", name: "f", args: {} }],
      });

      await continueAfterFunctionExecution(
        [],
        assistantMsg,
        [{ id: "t1", name: "f", result: { data: "value" } }],
      );

      const callArgs = mockInvoke.mock.calls[0][0];
      const toolMsg = callArgs.find((m) => m instanceof ToolMessage);
      expect(toolMsg).toBeDefined();
      expect(toolMsg.tool_call_id).toBe("t1");
    });
  });

  describe("error scenarios", () => {
    test("returns error on API failure", async () => {
      mockInvoke.mockRejectedValue(new Error("Server overloaded"));

      const assistantMsg = new AIMessage({ content: [], tool_calls: [] });
      const result = await continueAfterFunctionExecution([], assistantMsg, []);

      expect(result.error).toBe("Server overloaded");
    });

    test("handles token limit error during continuation", async () => {
      mockInvoke.mockRejectedValue(
        new Error("prompt is too long: 200001 tokens > 200000 maximum"),
      );

      const assistantMsg = new AIMessage({ content: [], tool_calls: [] });
      const result = await continueAfterFunctionExecution([], assistantMsg, []);

      expect(result.error).toMatch(/too long/);
    });

    test("falls back to generic error message", async () => {
      mockInvoke.mockRejectedValue({});

      const assistantMsg = new AIMessage({ content: [], tool_calls: [] });
      const result = await continueAfterFunctionExecution([], assistantMsg, []);

      expect(result.error).toBe(
        "Failed to generate response. Please try again.",
      );
    });
  });
});
