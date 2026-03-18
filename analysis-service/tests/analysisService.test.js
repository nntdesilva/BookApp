const mockToFile = jest.fn().mockImplementation(async (buffer, name, opts) => ({
  name,
  type: opts?.type,
}));

jest.mock("@anthropic-ai/sdk", () => {
  const mockBeta = {
    files: {
      upload: jest.fn(),
      delete: jest.fn(),
    },
    messages: {
      create: jest.fn(),
    },
  };
  const Constructor = jest.fn().mockImplementation(() => ({
    beta: mockBeta,
  }));
  Constructor.toFile = mockToFile;
  Constructor.__mockBeta = mockBeta;
  return Constructor;
});

jest.mock("../config/appConfig", () => ({
  claude: {
    apiKey: "test-key",
    model: "claude-sonnet-4-5",
  },
  services: {
    booksUrl: "http://localhost:3003",
  },
}));

const Anthropic = require("@anthropic-ai/sdk");

const mockBeta = Anthropic.__mockBeta;

beforeEach(() => {
  mockBeta.files.upload.mockReset();
  mockBeta.files.delete.mockReset();
  mockBeta.messages.create.mockReset();
  jest.clearAllMocks();
});

const {
  analyzeBookStatistics,
  generateVisualization,
} = require("../services/analysisService");

const bookResult = {
  success: true,
  text: "Once upon a time there was a cat.",
  bookTitle: "Test Book",
  authors: ["Author"],
};

function mockFetchSuccess(data = bookResult) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

function mockFetchFailure(status = 500) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
  });
}

// --- analyzeBookStatistics ---

describe("analyzeBookStatistics", () => {
  describe("happy path", () => {
    test("returns analysis answer on success", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockResolvedValue({ id: "file-123" });
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "The word 'cat' appears 1 time." }],
      });

      const result = await analyzeBookStatistics("Test Book", "count cats");
      expect(result.success).toBe(true);
      expect(result.answer).toContain("cat");
      expect(result.bookTitle).toBe("Test Book");
      expect(result.authors).toEqual(["Author"]);
      expect(mockBeta.files.delete).toHaveBeenCalledWith("file-123", expect.anything());
    });

    test("handles pause_turn continuations", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockResolvedValue({ id: "file-1" });

      mockBeta.messages.create
        .mockResolvedValueOnce({
          stop_reason: "pause_turn",
          container: { id: "c1" },
          content: [{ type: "text", text: "Part 1. " }],
        })
        .mockResolvedValueOnce({
          stop_reason: "end_turn",
          content: [{ type: "text", text: "Part 2." }],
        });

      const result = await analyzeBookStatistics("Test Book", "question");
      expect(result.success).toBe(true);
      expect(result.answer).toContain("Part 1");
      expect(result.answer).toContain("Part 2");
      expect(mockBeta.messages.create).toHaveBeenCalledTimes(2);
    });

    test("limits continuations to 5", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockResolvedValue({ id: "file-2" });

      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "pause_turn",
        content: [{ type: "text", text: "chunk " }],
      });

      const result = await analyzeBookStatistics("Test Book", "q");
      expect(mockBeta.messages.create).toHaveBeenCalledTimes(6);
      expect(result.success).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("returns error when analysis produces empty text", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockResolvedValue({ id: "file-3" });
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "   " }],
      });

      const result = await analyzeBookStatistics("Test Book", "q");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/did not produce a result/);
    });

    test("returns error when LLM returns no text blocks", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockResolvedValue({ id: "file-4" });
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [{ type: "code_execution", data: "some code" }],
      });

      const result = await analyzeBookStatistics("Test Book", "q");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/did not produce a result/);
    });
  });

  describe("error scenarios", () => {
    test("returns error when books-service returns not found", async () => {
      mockFetchSuccess({ success: false, error: "Book not found in Project Gutenberg" });

      const result = await analyzeBookStatistics("Missing", "q");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    test("returns error when books-service HTTP call fails", async () => {
      mockFetchFailure(503);

      const result = await analyzeBookStatistics("Test Book", "q");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Books service error/);
    });

    test("returns error on Claude API exception", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockResolvedValue({ id: "file-5" });
      mockBeta.messages.create.mockRejectedValue(new Error("Service unavailable"));

      const result = await analyzeBookStatistics("Test Book", "q");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Service unavailable");
    });

    test("cleans up uploaded file even on error", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockResolvedValue({ id: "file-cleanup" });
      mockBeta.messages.create.mockRejectedValue(new Error("fail"));

      await analyzeBookStatistics("Test Book", "q");
      expect(mockBeta.files.delete).toHaveBeenCalledWith("file-cleanup", expect.anything());
    });

    test("handles file cleanup failure gracefully", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockResolvedValue({ id: "file-6" });
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "answer" }],
      });
      mockBeta.files.delete.mockRejectedValue(new Error("cleanup failed"));

      const result = await analyzeBookStatistics("Test Book", "q");
      expect(result.success).toBe(true);
    });

    test("handles file upload failure", async () => {
      mockFetchSuccess();
      mockBeta.files.upload.mockRejectedValue(new Error("Upload failed"));

      const result = await analyzeBookStatistics("Test Book", "q");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Upload failed");
    });
  });
});

// --- generateVisualization ---

describe("generateVisualization", () => {
  const htmlDoc = '<!DOCTYPE html><html><body><div id="chart"></div></body></html>';

  describe("happy path", () => {
    test("extracts HTML between markers", async () => {
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [
          { type: "text", text: `---HTML_START---\n${htmlDoc}\n---HTML_END---` },
        ],
      });

      const result = await generateVisualization("data", "Book", ["Author"], "bar chart");
      expect(result.success).toBe(true);
      expect(result.html).toContain("<!DOCTYPE html>");
    });

    test("extracts raw HTML document from text block", async () => {
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: htmlDoc }],
      });

      const result = await generateVisualization("data", "Book", ["Author"], "pie chart");
      expect(result.success).toBe(true);
      expect(result.html).toContain("<!DOCTYPE html>");
    });

    test("extracts HTML from stdout content block", async () => {
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [
          {
            type: "tool_result",
            content: { stdout: `---HTML_START---\n${htmlDoc}\n---HTML_END---` },
          },
        ],
      });

      const result = await generateVisualization("data", "Book", ["Author"], "line chart");
      expect(result.success).toBe(true);
    });

    test("extracts HTML from markdown code block", async () => {
      const markdown = "```html\n" + htmlDoc + "\n```";
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: markdown }],
      });

      const result = await generateVisualization("data", "Book", ["Author"], "bar chart");
      expect(result.success).toBe(true);
      expect(result.html).toContain("<!DOCTYPE html>");
    });
  });

  describe("continuations", () => {
    test("handles pause_turn and retries up to 3 times", async () => {
      mockBeta.messages.create
        .mockResolvedValueOnce({
          stop_reason: "pause_turn",
          container: { id: "c1" },
          content: [{ type: "text", text: "Generating..." }],
        })
        .mockResolvedValueOnce({
          stop_reason: "pause_turn",
          container: { id: "c1" },
          content: [{ type: "text", text: "Still working..." }],
        })
        .mockResolvedValueOnce({
          stop_reason: "pause_turn",
          content: [{ type: "text", text: "Almost..." }],
        })
        .mockResolvedValueOnce({
          stop_reason: "end_turn",
          content: [{ type: "text", text: `---HTML_START---\n${htmlDoc}\n---HTML_END---` }],
        });

      const result = await generateVisualization("data", "Book", ["Author"], "bar chart");
      expect(mockBeta.messages.create).toHaveBeenCalledTimes(4);
      expect(result.success).toBe(true);
    });
  });

  describe("error scenarios", () => {
    test("returns error when no HTML is produced", async () => {
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "I could not generate a chart." }],
      });

      const result = await generateVisualization("data", "Book", ["Author"], "bar chart");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/did not produce valid HTML/);
    });

    test("returns error on API exception", async () => {
      mockBeta.messages.create.mockRejectedValue(new Error("API rate limited"));

      const result = await generateVisualization("data", "Book", ["Author"], "bar");
      expect(result.success).toBe(false);
      expect(result.error).toBe("API rate limited");
    });

    test("returns error when all continuations fail to produce HTML", async () => {
      mockBeta.messages.create.mockResolvedValue({
        stop_reason: "pause_turn",
        content: [{ type: "text", text: "Processing..." }],
      });

      const result = await generateVisualization("data", "Book", ["Author"], "bar");
      expect(mockBeta.messages.create).toHaveBeenCalledTimes(4);
      expect(result.success).toBe(false);
    });
  });
});
