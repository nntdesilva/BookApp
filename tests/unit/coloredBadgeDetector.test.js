/**
 * Unit Tests for AI-Powered Colored Book Badging System
 *
 * BADGE COLOR RULES:
 * - CREAM: Exact book searched by user
 * - GREEN: Books in same series as searched book
 * - ORANGE: Unrelated books (different series or standalone)
 */

const mockCreate = jest.fn();

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

process.env.OPENAI_API_KEY = "test-api-key";

const {
  classifyBookBadges,
  normalizeBookTitle,
  applyColoredBadges,
  extractMarkedTitles,
  extractQuotedTitles,
  isActualBookTitle,
  analyzeBookOrSeries,
} = require("../../utils/coloredBadgeDetector");

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockReset();
});

describe("AI-Powered Colored Book Badging System", () => {
  describe("analyzeBookOrSeries() - AI-Powered Book/Series Analysis", () => {
    test("should detect series name query", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isSeries: true,
                seriesName: "Harry Potter",
                allBooksInSeries: [
                  "Harry Potter and the Philosopher's Stone",
                  "Harry Potter and the Chamber of Secrets",
                  "Harry Potter and the Prisoner of Azkaban",
                ],
              }),
            },
          },
        ],
      });

      const result = await analyzeBookOrSeries("harry potter");

      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("Harry Potter");
      expect(result.allBooksInSeries).toHaveLength(3);
    });

    test("should detect specific book title and its series", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isSeries: false,
                seriesName: "Harry Potter",
                allBooksInSeries: [
                  "Harry Potter and the Philosopher's Stone",
                  "Harry Potter and the Chamber of Secrets",
                ],
              }),
            },
          },
        ],
      });

      const result = await analyzeBookOrSeries(
        "Harry Potter and the Philosopher's Stone",
      );

      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe("Harry Potter");
      expect(result.allBooksInSeries).toHaveLength(2);
    });

    test("should detect standalone book", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isSeries: false,
                seriesName: null,
                allBooksInSeries: [],
              }),
            },
          },
        ],
      });

      const result = await analyzeBookOrSeries("1984");

      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe(null);
      expect(result.allBooksInSeries).toEqual([]);
    });

    test("should handle AI response with markdown code blocks", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '```json\n{"isSeries": true, "seriesName": "The Hunger Games", "allBooksInSeries": ["The Hunger Games", "Catching Fire"]}\n```',
            },
          },
        ],
      });

      const result = await analyzeBookOrSeries("The Hunger Games");

      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("The Hunger Games");
    });

    test("should handle null input gracefully", async () => {
      const result = await analyzeBookOrSeries(null);

      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe(null);
      expect(result.allBooksInSeries).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test("should handle AI errors gracefully", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const result = await analyzeBookOrSeries("Some Book");

      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe(null);
      expect(result.allBooksInSeries).toEqual([]);
    });
  });

  describe("isActualBookTitle() - AI-Powered Title Validation", () => {
    test("should identify actual book title", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "book",
            },
          },
        ],
      });

      const result = await isActualBookTitle("The Hunger Games");

      expect(result).toBe(true);
    });

    test("should identify series name (not book)", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "series",
            },
          },
        ],
      });

      const result = await isActualBookTitle("Harry Potter");

      expect(result).toBe(false);
    });

    test("should handle null input", async () => {
      const result = await isActualBookTitle(null);

      expect(result).toBe(false);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("classifyBookBadges() - AI-Powered Badge Classification", () => {
    test("should classify CREAM for exact searched book", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: [
                  {
                    book: "Harry Potter and the Philosopher's Stone",
                    color: "CREAM",
                    reason: "Exact match to searched book",
                  },
                ],
              }),
            },
          },
        ],
      });

      const aiResponse = "[[Harry Potter and the Philosopher's Stone]]";
      const result = await classifyBookBadges(
        aiResponse,
        "harry potter",
        "Harry Potter and the Philosopher's Stone",
        "Harry Potter",
      );

      expect(result.creamBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should classify GREEN for books in same series", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: [
                  {
                    book: "Harry Potter and the Philosopher's Stone",
                    color: "CREAM",
                    reason: "Exact match",
                  },
                  {
                    book: "Harry Potter and the Chamber of Secrets",
                    color: "GREEN",
                    reason: "Same series",
                  },
                ],
              }),
            },
          },
        ],
      });

      const aiResponse =
        "[[Harry Potter and the Philosopher's Stone]] [[Harry Potter and the Chamber of Secrets]]";
      const result = await classifyBookBadges(
        aiResponse,
        "harry potter",
        "Harry Potter and the Philosopher's Stone",
        "Harry Potter",
      );

      expect(result.creamBadgeBooks).toHaveLength(1);
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
    });

    test("should classify ORANGE for unrelated books", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: [
                  {
                    book: "Harry Potter and the Philosopher's Stone",
                    color: "CREAM",
                    reason: "Exact match",
                  },
                  {
                    book: "1984",
                    color: "ORANGE",
                    reason: "Different series",
                  },
                ],
              }),
            },
          },
        ],
      });

      const aiResponse =
        "[[Harry Potter and the Philosopher's Stone]] [[1984]]";
      const result = await classifyBookBadges(
        aiResponse,
        "harry potter",
        "Harry Potter and the Philosopher's Stone",
        "Harry Potter",
      );

      expect(result.orangeBadgeBooks).toContain("1984");
    });

    test("should handle empty AI response", async () => {
      const result = await classifyBookBadges("", "test", "test", null);

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should handle null AI response", async () => {
      const result = await classifyBookBadges(null, "test", "test", null);

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should handle AI errors gracefully (fallback to orange)", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const aiResponse = "[[Some Book]]";
      const result = await classifyBookBadges(aiResponse, "test", "test", null);

      expect(result.orangeBadgeBooks).toContain("Some Book");
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
    });

    test("should handle response with no marked books", async () => {
      const aiResponse = "This is just plain text with no book titles.";
      const result = await classifyBookBadges(aiResponse, "test", "test", null);

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("applyColoredBadges() - HTML Badge Generation", () => {
    test("should apply cream badge class", () => {
      const aiResponse = "[[Harry Potter and the Philosopher's Stone]]";
      const classification = {
        creamBadgeBooks: ["Harry Potter and the Philosopher's Stone"],
        greenBadgeBooks: [],
        orangeBadgeBooks: [],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain('class="book-badge book-badge-cream"');
      expect(html).toContain("Harry Potter and the Philosopher's Stone");
    });

    test("should apply green badge class", () => {
      const aiResponse = "[[Harry Potter and the Chamber of Secrets]]";
      const classification = {
        creamBadgeBooks: [],
        greenBadgeBooks: ["Harry Potter and the Chamber of Secrets"],
        orangeBadgeBooks: [],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain('class="book-badge book-badge-green"');
    });

    test("should apply orange badge class", () => {
      const aiResponse = "[[1984]]";
      const classification = {
        creamBadgeBooks: [],
        greenBadgeBooks: [],
        orangeBadgeBooks: ["1984"],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain('class="book-badge book-badge-orange"');
    });

    test("should apply correct classes to mixed badge colors", () => {
      const aiResponse = "[[Book1]] [[Book2]] [[Book3]]";
      const classification = {
        creamBadgeBooks: ["Book1"],
        greenBadgeBooks: ["Book2"],
        orangeBadgeBooks: ["Book3"],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain("book-badge-cream");
      expect(html).toContain("book-badge-green");
      expect(html).toContain("book-badge-orange");
    });

    test("should not badge series names followed by series indicator", () => {
      const aiResponse = "[[Harry Potter]] series";
      const classification = {
        creamBadgeBooks: [],
        greenBadgeBooks: [],
        orangeBadgeBooks: [],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).not.toContain("book-badge");
      expect(html).toBe("Harry Potter series");
    });

    test("should handle multiple instances of same book", () => {
      const aiResponse =
        "[[1984]] was written in 1949. [[1984]] is about totalitarianism.";
      const classification = {
        creamBadgeBooks: ["1984"],
        greenBadgeBooks: [],
        orangeBadgeBooks: [],
      };

      const html = applyColoredBadges(aiResponse, classification);

      const creamBadgeCount = (html.match(/book-badge-cream/g) || []).length;
      expect(creamBadgeCount).toBe(2);
    });

    test("should badge quoted titles when in classification", () => {
      const aiResponse = '"The Great Gatsby" is a classic.';
      const classification = {
        creamBadgeBooks: [],
        greenBadgeBooks: [],
        orangeBadgeBooks: ["The Great Gatsby"],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain("book-badge-orange");
    });
  });

  describe("extractMarkedTitles() - Extract [[Bracketed]] Titles", () => {
    test("should extract single book title", () => {
      const text =
        "The book [[Harry Potter and the Philosopher's Stone]] is great.";
      const titles = extractMarkedTitles(text);

      expect(titles).toEqual(["Harry Potter and the Philosopher's Stone"]);
    });

    test("should extract multiple book titles", () => {
      const text = "[[Book1]] and [[Book2]] and [[Book3]]";
      const titles = extractMarkedTitles(text);

      expect(titles).toEqual(["Book1", "Book2", "Book3"]);
    });

    test("should extract quoted titles as fallback", () => {
      const text = '"The Great Gatsby" is a book.';
      const titles = extractMarkedTitles(text);

      expect(titles).toContain("The Great Gatsby");
    });

    test("should return empty array for text with no marked books", () => {
      const text = "This is just plain text.";
      const titles = extractMarkedTitles(text);

      expect(titles).toEqual([]);
    });

    test("should handle null input", () => {
      const titles = extractMarkedTitles(null);

      expect(titles).toEqual([]);
    });
  });

  describe("extractQuotedTitles() - Extract Quoted Titles", () => {
    test("should extract titles from double quotes", () => {
      const text = '"The Great Gatsby" is a novel.';
      const titles = extractQuotedTitles(text);

      expect(titles).toContain("The Great Gatsby");
    });

    test("should extract titles from italics", () => {
      const text = "*Pride and Prejudice* is a classic.";
      const titles = extractQuotedTitles(text);

      expect(titles).toContain("Pride and Prejudice");
    });

    test("should not extract single words", () => {
      const text = '"power" is important.';
      const titles = extractQuotedTitles(text);

      expect(titles).toEqual([]);
    });

    test("should handle null input", () => {
      const titles = extractQuotedTitles(null);

      expect(titles).toEqual([]);
    });
  });

  describe("normalizeBookTitle() - Title Cleanup", () => {
    test("should trim whitespace", () => {
      const normalized = normalizeBookTitle("  The Great Gatsby  ");

      expect(normalized).toBe("The Great Gatsby");
    });

    test("should handle null input", () => {
      const normalized = normalizeBookTitle(null);

      expect(normalized).toBe(null);
    });

    test("should return trimmed title as-is (AI handles variations)", () => {
      const normalized = normalizeBookTitle("harry potter");

      expect(normalized).toBe("harry potter");
    });
  });

  describe("Integration Scenarios - End-to-End Badge Classification", () => {
    test("SCENARIO: User searches for book in series", async () => {
      // Mock classification call
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: [
                  {
                    book: "The Fellowship of the Ring",
                    color: "CREAM",
                    reason: "Exact match",
                  },
                  {
                    book: "The Two Towers",
                    color: "GREEN",
                    reason: "Same series",
                  },
                  {
                    book: "The Hobbit",
                    color: "ORANGE",
                    reason: "Different series",
                  },
                ],
              }),
            },
          },
        ],
      });

      const aiResponse =
        "[[The Fellowship of the Ring]] [[The Two Towers]] [[The Hobbit]]";
      const classification = await classifyBookBadges(
        aiResponse,
        "fellowship of the ring",
        "The Fellowship of the Ring",
        "The Lord of the Rings",
      );

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain("book-badge-cream");
      expect(html).toContain("book-badge-green");
      expect(html).toContain("book-badge-orange");
    });

    test("SCENARIO: User searches for standalone book", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: [
                  { book: "1984", color: "CREAM", reason: "Exact match" },
                  {
                    book: "Animal Farm",
                    color: "ORANGE",
                    reason: "Different book",
                  },
                ],
              }),
            },
          },
        ],
      });

      const aiResponse = "[[1984]] and [[Animal Farm]] are by Orwell.";
      const classification = await classifyBookBadges(
        aiResponse,
        "1984",
        "1984",
        null,
      );

      expect(classification.creamBadgeBooks).toContain("1984");
      expect(classification.orangeBadgeBooks).toContain("Animal Farm");
      expect(classification.greenBadgeBooks).toEqual([]);
    });
  });
});
