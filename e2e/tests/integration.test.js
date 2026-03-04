/**
 * End-to-End Integration Tests — Live API calls with real keys
 *
 * These tests hit Gutenberg, OpenAI (embeddings), and Anthropic (Claude) for real.
 * They verify that the full pipelines produce correct, consistent results.
 *
 * Run:  npx jest e2e/tests/integration.test.js --verbose
 * Requires: ANTHROPIC_API_KEY and OPENAI_EMBEDDINGS_API_KEY in .env
 *
 * NOTE: Service modules are imported directly (not via HTTP).
 * Node.js resolves require() relative to the source file's location,
 * so all internal imports within each service remain correct.
 */

require("dotenv").config();

const gutenbergService = require("../../books-service/services/gutenbergService");
const embeddingService = require("../../books-service/services/embeddingService");
const analysisService = require("../../analysis-service/services/analysisService");
const aiService = require("../../chat-service/services/aiService");

jest.setTimeout(180_000);

// ---------------------------------------------------------------------------
// Bridge: analysisService calls the books-service via HTTP, but in e2e tests
// the services aren't running as actual servers — we import modules directly.
// Intercept fetch calls to the books-service URL and delegate to the
// gutenbergService module instead, keeping the test fully integration-style.
// ---------------------------------------------------------------------------
const BOOKS_URL = process.env.BOOKS_SERVICE_URL || "http://localhost:3003";
const _originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = async (url, options) => {
    if (typeof url === "string" && url.startsWith(BOOKS_URL)) {
      const pathname = new URL(url).pathname;
      if (pathname.endsWith("/api/books/text")) {
        const body = JSON.parse(options?.body || "{}");
        const result = await gutenbergService.getBookFullText(body.bookTitle);
        return { ok: true, json: async () => result };
      }
    }
    return _originalFetch(url, options);
  };
});

afterAll(() => {
  global.fetch = _originalFetch;
});

// ---------------------------------------------------------------------------
// 1. Gutenberg Service (network only — no API keys)
// ---------------------------------------------------------------------------

describe("Gutenberg Service", () => {
  test("searchBook finds Pride and Prejudice", async () => {
    const result = await gutenbergService.searchBook("Pride and Prejudice");

    expect(result.found).toBe(true);
    expect(result.book.title).toMatch(/Pride and Prejudice/i);
    expect(result.book.authors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Austen/i)]),
    );
    expect(result.book.textUrl).toBeTruthy();
  });

  test("getBookFullText fetches a complete book", async () => {
    const result = await gutenbergService.getBookFullText("A Christmas Carol");

    expect(result.success).toBe(true);
    expect(result.text.length).toBeGreaterThan(10_000);
    expect(result.bookTitle).toMatch(/Christmas Carol/i);
    expect(result.authors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Dickens/i)]),
    );
  });

  test('countWordInBook counts "elizabeth" in Pride and Prejudice', async () => {
    const result = await gutenbergService.countWordInBook(
      "Pride and Prejudice",
      "elizabeth",
    );

    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(500);
    expect(result.bookTitle).toMatch(/Pride and Prejudice/i);
  });

  test("direct count matches service-level count", async () => {
    const fullText = await gutenbergService.getBookFullText("Pride and Prejudice");
    expect(fullText.success).toBe(true);

    const directCount = gutenbergService.countWordOccurrences(fullText.text, "darcy");
    const serviceCount = await gutenbergService.countWordInBook("Pride and Prejudice", "darcy");

    expect(serviceCount.success).toBe(true);
    expect(serviceCount.count).toBe(directCount.count);
  });

  test("returns failure for a non-existent book", async () => {
    const result = await gutenbergService.countWordInBook(
      "zzznonexistentbook12345",
      "hello",
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. Embedding Service (OpenAI — needs OPENAI_EMBEDDINGS_API_KEY)
// ---------------------------------------------------------------------------

describe("Embedding Service (OpenAI)", () => {
  const needsKey = !process.env.OPENAI_EMBEDDINGS_API_KEY;
  const conditionalTest = needsKey ? test.skip : test;

  conditionalTest(
    'findRelatedWords finds words semantically close to "love"',
    async () => {
      const words = [
        "love", "romance", "heart", "passion", "kiss", "affection",
        "hate", "anger", "sword", "table", "chair", "computer", "refrigerator",
      ];

      const related = await embeddingService.findRelatedWords("love", words, 0.4);
      const found = related.map((r) => r.word);

      expect(found).toContain("love");
      expect(
        found.some((w) => ["romance", "heart", "passion", "kiss", "affection"].includes(w)),
      ).toBe(true);
      expect(found).not.toContain("computer");
      expect(found).not.toContain("refrigerator");
    },
  );

  conditionalTest("results are sorted by similarity descending", async () => {
    const words = ["happy", "sad", "joy", "car", "tree", "delight", "bliss"];
    const related = await embeddingService.findRelatedWords("happiness", words, 0.3);

    for (let i = 1; i < related.length; i++) {
      expect(related[i].similarity).toBeLessThanOrEqual(related[i - 1].similarity);
    }
  });

  conditionalTest("returns empty array when no words meet the threshold", async () => {
    const words = ["computer", "keyboard", "monitor"];
    const related = await embeddingService.findRelatedWords("love", words, 0.95);
    expect(related).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Analysis Service (Anthropic Code Execution — needs ANTHROPIC_API_KEY)
// ---------------------------------------------------------------------------

describe("Analysis Service (Claude Code Execution)", () => {
  const needsKey = !process.env.ANTHROPIC_API_KEY;
  const conditionalTest = needsKey ? test.skip : test;

  conditionalTest(
    "analyzeBookStatistics computes a word count for A Christmas Carol",
    async () => {
      const result = await analysisService.analyzeBookStatistics(
        "A Christmas Carol",
        'Count the exact number of times the word "Scrooge" appears in this book (case-insensitive). Report just the number.',
      );

      expect(result.success).toBe(true);
      expect(result.answer).toBeTruthy();
      expect(result.bookTitle).toMatch(/Christmas Carol/i);

      const numbers = result.answer.match(/\d+/g);
      expect(numbers).not.toBeNull();

      const book = await gutenbergService.getBookFullText("A Christmas Carol");
      const directCount = gutenbergService.countWordOccurrences(book.text, "Scrooge");

      const codeExecCount = numbers.map(Number).find((n) => n > 50 && n < 10000);
      if (codeExecCount !== undefined) {
        expect(Math.abs(codeExecCount - directCount.count)).toBeLessThan(15);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 4. AI Chat Service (Anthropic — needs ANTHROPIC_API_KEY)
// ---------------------------------------------------------------------------

describe("AI Chat Service", () => {
  const needsKey = !process.env.ANTHROPIC_API_KEY;
  const conditionalTest = needsKey ? test.skip : test;

  conditionalTest("generates a text response for a general book question", async () => {
    const result = await aiService.generateChatResponse(
      "What is Pride and Prejudice about? Answer in one sentence.",
      [],
    );

    expect(result.success).toBe(true);
    expect(result.response).toBeTruthy();
    expect(result.response.length).toBeGreaterThan(20);
    expect(result.conversationHistory).toHaveLength(2);
  });

  conditionalTest("requests a tool call when asked about word count", async () => {
    const result = await aiService.generateChatResponse(
      'How many times does the word "whale" appear in Moby Dick?',
      [],
    );

    expect(result.success).toBe(true);
    expect(result.requiresFunctionExecution).toBe(true);
    expect(result.functionCalls.length).toBeGreaterThan(0);

    const names = result.functionCalls.map((fc) => fc.name);
    expect(
      names.includes("resolve_book_for_search") || names.includes("count_word_in_book"),
    ).toBe(true);
  });

  conditionalTest("maintains conversation history across turns", async () => {
    const turn1 = await aiService.generateChatResponse(
      "Remember the number 42. Just say OK.",
      [],
    );

    expect(turn1.success).toBe(true);
    expect(turn1.conversationHistory).toHaveLength(2);

    const turn2 = await aiService.generateChatResponse(
      "What number did I just ask you to remember?",
      turn1.conversationHistory,
    );

    expect(turn2.success).toBe(true);
    expect(turn2.response).toMatch(/42/);
  });
});

// ---------------------------------------------------------------------------
// 5. End-to-End: Word Count Verification
// ---------------------------------------------------------------------------

describe("End-to-End Word Count Verification", () => {
  const needsKey = !process.env.ANTHROPIC_API_KEY;
  const conditionalTest = needsKey ? test.skip : test;

  conditionalTest(
    'AI returns the correct count of "pride" in Pride and Prejudice',
    async () => {
      const directResult = await gutenbergService.countWordInBook(
        "Pride and Prejudice",
        "pride",
      );
      expect(directResult.success).toBe(true);
      const actualCount = directResult.count;

      let result = await aiService.generateChatResponse(
        'How many times does the word "pride" appear in Pride and Prejudice? Give me the exact count.',
        [],
      );
      expect(result.success).toBe(true);

      let finalResponse = result.response;
      let rounds = 0;

      while (result.requiresFunctionExecution && rounds < 5) {
        rounds++;
        const functionResults = [];

        for (const call of result.functionCalls) {
          let fnResult;
          if (call.name === "resolve_book_for_search") {
            fnResult = await gutenbergService.resolveBookForSearch(call.arguments.bookTitle);
          } else if (call.name === "count_word_in_book") {
            fnResult = await gutenbergService.countWordInBook(
              call.arguments.bookTitle,
              call.arguments.searchTerm,
            );
          } else {
            fnResult = { success: false, error: `Unsupported: ${call.name}` };
          }

          functionResults.push({ id: call.id, name: call.name, result: fnResult });
        }

        result = await aiService.continueAfterFunctionExecution(
          result.conversationHistory,
          result.assistantMessage,
          functionResults,
        );

        if (!result.requiresFunctionExecution) {
          finalResponse = result.response;
        }
      }

      expect(finalResponse).toBeTruthy();
      expect(finalResponse).toContain(String(actualCount));
    },
  );
});

// ---------------------------------------------------------------------------
// 6. End-to-End: Semantic Word Search
// ---------------------------------------------------------------------------

describe("End-to-End Semantic Search", () => {
  const needsBothKeys =
    !process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_EMBEDDINGS_API_KEY;
  const conditionalTest = needsBothKeys ? test.skip : test;

  conditionalTest(
    "finds color-related words in Alice's Adventures in Wonderland",
    async () => {
      const bookResult = await gutenbergService.getBookFullText(
        "Alice's Adventures in Wonderland",
      );
      expect(bookResult.success).toBe(true);

      const uniqueWords = gutenbergService.extractUniqueWords(bookResult.text);
      expect(uniqueWords.length).toBeGreaterThan(100);

      const related = await embeddingService.findRelatedWords("colors", uniqueWords);

      const foundWords = related.map((r) => r.word);
      const colorWords = ["white", "red", "golden", "pink", "black", "green"];
      const matchedColors = colorWords.filter((c) => foundWords.includes(c));
      expect(matchedColors.length).toBeGreaterThanOrEqual(2);
    },
  );
});
