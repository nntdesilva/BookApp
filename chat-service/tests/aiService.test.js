jest.mock("@anthropic-ai/sdk", () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

jest.mock("../config/appConfig", () => ({
  claude: {
    apiKey: "test-api-key",
    model: "claude-sonnet-4-20250514",
    temperature: 0.7,
    maxTokens: 1000,
  },
}));

const Anthropic = require("@anthropic-ai/sdk");

let mockCreate;

beforeEach(() => {
  const instance = Anthropic.mock.results[0]?.value;
  if (instance) {
    mockCreate = instance.messages.create;
    mockCreate.mockReset();
  }
  process.env.ANTHROPIC_API_KEY = "test-api-key";
});

const {
  generateChatResponse,
  continueAfterFunctionExecution,
} = require("../services/aiService");

// --- generateChatResponse ---

describe("generateChatResponse", () => {
  describe("happy path", () => {
    test("returns text response for non-tool messages", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Hello! How can I help?" }],
      });

      const result = await generateChatResponse("Hi", []);
      expect(result.success).toBe(true);
      expect(result.response).toBe("Hello! How can I help?");
      expect(result.conversationHistory).toHaveLength(2);
      expect(result.conversationHistory[0].role).toBe("user");
      expect(result.conversationHistory[1].role).toBe("assistant");
    });

    test("concatenates multiple text blocks", async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: "text", text: "Part 1" },
          { type: "text", text: "Part 2" },
        ],
      });

      const result = await generateChatResponse("Hello", []);
      expect(result.response).toBe("Part 1\nPart 2");
    });

    test("returns tool calls when Claude wants to use tools", async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: "text", text: "Let me check..." },
          {
            type: "tool_use",
            id: "tool_1",
            name: "add_to_favorites",
            input: { isbn13: "9780140449136", title: "Brothers K" },
          },
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

    test("passes conversation history to API", async () => {
      const history = [
        { role: "user", content: "first" },
        { role: "assistant", content: [{ type: "text", text: "response" }] },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
      });

      await generateChatResponse("second", history);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            ...history,
            { role: "user", content: "second" },
          ],
        }),
      );
    });
  });

  describe("edge cases", () => {
    test("handles empty content array from LLM (malformed output)", async () => {
      mockCreate.mockResolvedValue({ content: [] });

      const result = await generateChatResponse("test", []);
      expect(result.success).toBe(true);
      expect(result.response).toBe("");
    });

    test("handles response with only non-text/non-tool blocks", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "unknown_block", data: "something" }],
      });

      const result = await generateChatResponse("test", []);
      expect(result.success).toBe(true);
      expect(result.response).toBe("");
    });

    test("uses empty array as default conversation history", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "hi" }],
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
      mockCreate.mockRejectedValue(new Error("Rate limit exceeded"));

      const result = await generateChatResponse("hello", []);
      expect(result.error).toBe("Rate limit exceeded");
    });

    test("handles token limit / overloaded error", async () => {
      mockCreate.mockRejectedValue(
        new Error(
          "This request would exceed the token limit. Please reduce your prompt.",
        ),
      );

      const result = await generateChatResponse("very long message", []);
      expect(result.error).toMatch(/token limit/i);
    });

    test("handles network timeout error", async () => {
      mockCreate.mockRejectedValue(new Error("Request timed out"));

      const result = await generateChatResponse("hello", []);
      expect(result.error).toBe("Request timed out");
    });

    test("falls back to generic message when error has no message", async () => {
      mockCreate.mockRejectedValue({});

      const result = await generateChatResponse("hello", []);
      expect(result.error).toBe(
        "Failed to generate response. Please try again.",
      );
    });
  });
});

// --- continueAfterFunctionExecution ---

describe("continueAfterFunctionExecution", () => {
  describe("happy path", () => {
    test("returns final text response after tool execution", async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: "text", text: "Done! I added the book to your favorites." },
        ],
      });

      const result = await continueAfterFunctionExecution(
        [{ role: "user", content: "add this book" }],
        {
          content: [
            { type: "text", text: "Let me add that." },
            {
              type: "tool_use",
              id: "t1",
              name: "add_to_favorites",
              input: {},
            },
          ],
        },
        [{ id: "t1", name: "add_to_favorites", result: { success: true } }],
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("added the book");
      expect(result.conversationHistory.length).toBeGreaterThan(0);
    });

    test("returns more tool calls when Claude chains tools", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "tool_use",
            id: "t2",
            name: "count_word_in_book",
            input: { bookTitle: "Book", searchTerm: "love" },
          },
        ],
      });

      const result = await continueAfterFunctionExecution(
        [],
        {
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "resolve_book_for_search",
              input: {},
            },
          ],
        },
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
      mockCreate.mockResolvedValue({ content: [] });

      const result = await continueAfterFunctionExecution(
        [],
        { content: [{ type: "tool_use", id: "t", name: "f", input: {} }] },
        [{ id: "t", name: "f", result: {} }],
      );

      expect(result.success).toBe(true);
      expect(result.response).toBe("");
    });

    test("correctly builds tool_result content blocks", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
      });

      await continueAfterFunctionExecution(
        [],
        { content: [{ type: "tool_use", id: "t1", name: "f", input: {} }] },
        [{ id: "t1", name: "f", result: { data: "value" } }],
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const lastUserMsg = callArgs.messages[callArgs.messages.length - 1];
      expect(lastUserMsg.role).toBe("user");
      expect(lastUserMsg.content[0].type).toBe("tool_result");
      expect(lastUserMsg.content[0].tool_use_id).toBe("t1");
    });
  });

  describe("error scenarios", () => {
    test("returns error on API failure", async () => {
      mockCreate.mockRejectedValue(new Error("Server overloaded"));

      const result = await continueAfterFunctionExecution(
        [],
        { content: [] },
        [],
      );

      expect(result.error).toBe("Server overloaded");
    });

    test("handles token limit error during continuation", async () => {
      mockCreate.mockRejectedValue(
        new Error("prompt is too long: 200001 tokens > 200000 maximum"),
      );

      const result = await continueAfterFunctionExecution(
        [],
        { content: [] },
        [],
      );

      expect(result.error).toMatch(/too long/);
    });

    test("falls back to generic error message", async () => {
      mockCreate.mockRejectedValue({});

      const result = await continueAfterFunctionExecution(
        [],
        { content: [] },
        [],
      );

      expect(result.error).toBe(
        "Failed to generate response. Please try again.",
      );
    });
  });
});
