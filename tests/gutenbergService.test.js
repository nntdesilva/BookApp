jest.mock("../config/appConfig", () => ({
  gutenberg: { apiBaseUrl: "https://gutendex.com" },
}));

jest.mock("../services/embeddingService", () => ({
  findRelatedWords: jest.fn(),
}));

const gutenbergService = require("../services/gutenbergService");

// --- Pure functions (no network) ---

describe("countWordOccurrences", () => {
  const text = "The quick brown fox jumps over the lazy dog. The fox is quick.";

  test("counts single word with word boundaries", () => {
    expect(gutenbergService.countWordOccurrences(text, "the").count).toBe(3);
  });

  test("is case-insensitive", () => {
    expect(gutenbergService.countWordOccurrences(text, "THE").count).toBe(3);
  });

  test("counts a phrase", () => {
    expect(
      gutenbergService.countWordOccurrences(text, "the quick").count,
    ).toBe(1);
  });

  test("returns 0 for non-existent word", () => {
    expect(gutenbergService.countWordOccurrences(text, "cat").count).toBe(0);
  });

  test("does not partial-match inside other words", () => {
    expect(gutenbergService.countWordOccurrences(text, "fox").count).toBe(2);
    expect(gutenbergService.countWordOccurrences(text, "fo").count).toBe(0);
  });

  test("handles regex special characters in a multi-word phrase", () => {
    const special = "The price is $5.00 USD. I paid $5.00 USD too.";
    expect(
      gutenbergService.countWordOccurrences(special, "$5.00 USD").count,
    ).toBe(2);
  });

  test("word-boundary matching does not find non-word-char terms like $5.00", () => {
    const text = "It costs $5.00 total.";
    // Single-word path uses \\b which won't match around non-word chars
    expect(
      gutenbergService.countWordOccurrences(text, "$5.00").count,
    ).toBe(0);
  });

  test("returns the original term in the result", () => {
    const result = gutenbergService.countWordOccurrences(text, "Fox");
    expect(result.term).toBe("Fox");
  });
});

describe("extractUniqueWords", () => {
  test("extracts and deduplicates lowercase words", () => {
    const words = gutenbergService.extractUniqueWords("The the THE cat Cat");
    expect(words).toContain("the");
    expect(words).toContain("cat");
    expect(words.filter((w) => w === "the")).toHaveLength(1);
  });

  test("filters out single-character tokens", () => {
    const words = gutenbergService.extractUniqueWords("I a am");
    expect(words).not.toContain("i");
    expect(words).not.toContain("a");
    expect(words).toContain("am");
  });

  test("strips surrounding punctuation from words", () => {
    const words = gutenbergService.extractUniqueWords("'hello' --world--");
    expect(words).toContain("hello");
    expect(words).toContain("world");
  });

  test("handles empty string", () => {
    expect(gutenbergService.extractUniqueWords("")).toEqual([]);
  });

  test("handles text with only punctuation", () => {
    expect(gutenbergService.extractUniqueWords("!!! ??? ...")).toEqual([]);
  });
});

// --- Network-dependent functions (mock global fetch) ---

describe("searchBook", () => {
  afterEach(() => jest.restoreAllMocks());

  test("returns book when found with exact title match", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1342,
            title: "Pride and Prejudice",
            authors: [{ name: "Austen, Jane" }],
            formats: { "text/plain; charset=utf-8": "https://example.com/book.txt" },
            languages: ["en"],
          },
        ],
      }),
    });

    const result = await gutenbergService.searchBook("Pride and Prejudice");
    expect(result.found).toBe(true);
    expect(result.book.title).toBe("Pride and Prejudice");
    expect(result.book.authors).toEqual(["Austen, Jane"]);
    expect(result.book.textUrl).toBe("https://example.com/book.txt");
  });

  test("returns not found when no results", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await gutenbergService.searchBook("Nonexistent Book ZZZZZ");
    expect(result.found).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test("returns error on API failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    const result = await gutenbergService.searchBook("Error Book");
    expect(result.found).toBe(false);
    expect(result.error).toMatch(/500/);
  });

  test("returns error when book has no text format", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 999,
            title: "Audio Only",
            authors: [{ name: "Author" }],
            formats: { "audio/mpeg": "https://example.com/audio.mp3" },
            languages: ["en"],
          },
        ],
      }),
    });

    const result = await gutenbergService.searchBook("Audio Only");
    expect(result.found).toBe(false);
    expect(result.error).toMatch(/no text format/i);
  });

  test("handles network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const result = await gutenbergService.searchBook("Unreachable");
    expect(result.found).toBe(false);
    expect(result.error).toMatch(/Network error/);
  });
});

describe("fetchBookText", () => {
  afterEach(() => jest.restoreAllMocks());

  test("fetches text successfully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => "Full book text here",
    });

    const result = await gutenbergService.fetchBookText(
      "https://example.com/book.txt",
    );
    expect(result.success).toBe(true);
    expect(result.text).toBe("Full book text here");
  });

  test("returns error on HTTP failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    const result = await gutenbergService.fetchBookText(
      "https://example.com/missing.txt",
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/404/);
  });

  test("returns error on network failure", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Timeout"));

    const result = await gutenbergService.fetchBookText(
      "https://example.com/slow.txt",
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Timeout/);
  });
});

describe("resolveBookForSearch", () => {
  afterEach(() => jest.restoreAllMocks());

  test("returns available when book found", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1342,
            title: "Pride and Prejudice",
            authors: [{ name: "Austen, Jane" }],
            formats: { "text/plain; charset=utf-8": "https://example.com/pp.txt" },
            languages: ["en"],
          },
        ],
      }),
    });

    const result = await gutenbergService.resolveBookForSearch(
      "Pride and Prejudice",
    );
    expect(result.available).toBe(true);
    expect(result.title).toBe("Pride and Prejudice");
  });

  test("returns unavailable when book not found", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await gutenbergService.resolveBookForSearch("Unknown");
    expect(result.available).toBe(false);
    expect(result.searchedTitle).toBe("Unknown");
  });
});

describe("countWordInBook", () => {
  afterEach(() => jest.restoreAllMocks());

  test("counts word in a real book flow", async () => {
    // Mock search
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 1,
              title: "Test Book; With Subtitle",
              authors: [{ name: "Author" }],
              formats: {
                "text/plain; charset=utf-8": "https://example.com/test.txt",
              },
              languages: ["en"],
            },
          ],
        }),
      })
      // Mock text fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          "Love is patient. Love is kind. love conquers all.",
      });

    const result = await gutenbergService.countWordInBook("Test Book", "love");
    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
    expect(result.bookTitle).toBe("Test Book");
  });

  test("returns error when book not found", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await gutenbergService.countWordInBook("Missing", "word");
    expect(result.success).toBe(false);
  });

  test("returns error when text fetch fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 1,
              title: "Book",
              authors: [{ name: "A" }],
              formats: { "text/plain": "https://example.com/t.txt" },
              languages: ["en"],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await gutenbergService.countWordInBook("Book", "word");
    expect(result.success).toBe(false);
  });
});

describe("getBookFullText", () => {
  afterEach(() => jest.restoreAllMocks());

  test("returns full text on success", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 1,
              title: "Moby Dick; or The Whale",
              authors: [{ name: "Melville, Herman" }],
              formats: { "text/plain": "https://example.com/moby.txt" },
              languages: ["en"],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "Call me Ishmael.",
      });

    const result = await gutenbergService.getBookFullText("Moby Dick");
    expect(result.success).toBe(true);
    expect(result.text).toBe("Call me Ishmael.");
    expect(result.bookTitle).toBe("Moby Dick");
  });

  test("returns error when book not available", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await gutenbergService.getBookFullText("Nonexistent");
    expect(result.success).toBe(false);
  });
});
