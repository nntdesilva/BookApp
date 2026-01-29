/**
 * COMPREHENSIVE COLORED BADGING TEST SUITE
 *
 * This test suite covers EVERY possible scenario for colored badging in both search and chat contexts.
 *
 * BADGE COLOR RULES:
 *
 * 1. USER SEARCHED FOR A SERIES (e.g., "Harry Potter", "Lord of the Rings"):
 *    - CREAM: NEVER used (no original book)
 *    - GREEN: Books of that series
 *    - ORANGE: Any other book (different series or standalone)
 *
 * 2. USER SEARCHED FOR A BOOK IN A SERIES (e.g., "Harry Potter and the Philosopher's Stone"):
 *    - CREAM: The exact book searched
 *    - GREEN: Other books in same series
 *    - ORANGE: Any other book (different series or standalone)
 *
 * 3. USER SEARCHED FOR A STANDALONE BOOK (e.g., "Anna Karenina", "1984"):
 *    - CREAM: The exact book searched
 *    - GREEN: NEVER used (no series)
 *    - ORANGE: Any other book
 *
 * CRITICAL: These rules apply to BOTH initial search response AND all subsequent chat messages!
 */

const {
  classifyBookBadges,
  getSeriesInfo,
  isSeriesQuery,
  applyColoredBadges,
  BOOK_SERIES,
} = require("../utils/coloredBadgeDetector");

describe("COMPREHENSIVE COLORED BADGING SYSTEM", () => {
  // ============================================================================
  // SCENARIO 1: USER SEARCHED FOR A SERIES
  // ============================================================================
  describe("SCENARIO 1: User searched for a SERIES (e.g., 'Harry Potter', 'Lord of the Rings')", () => {
    describe("1A: Initial Search Response - Harry Potter Series", () => {
      const searchedQuery = "harry potter";
      const searchedBook = null; // null because user searched for series
      const seriesName = "Harry Potter";

      test("should use GREEN for books in the Harry Potter series", () => {
        const aiResponse = `
          The Harry Potter series includes:
          [[Harry Potter and the Philosopher's Stone]]
          [[Harry Potter and the Chamber of Secrets]]
          [[Harry Potter and the Goblet of Fire]]
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]); // NEVER cream for series search
        expect(result.greenBadgeBooks).toEqual(
          expect.arrayContaining([
            "Harry Potter and the Philosopher's Stone",
            "Harry Potter and the Chamber of Secrets",
            "Harry Potter and the Goblet of Fire",
          ]),
        );
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for books NOT in Harry Potter series", () => {
        const aiResponse = `
          [[Harry Potter and the Philosopher's Stone]] is part of the series.
          Other J.K. Rowling books include [[The Ickabog]] and [[The Casual Vacancy]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining(["The Ickabog", "The Casual Vacancy"]),
        );
      });

      test("should NEVER use CREAM (no original book for series search)", () => {
        const aiResponse = `
          [[Harry Potter and the Philosopher's Stone]] is the first book.
          [[Harry Potter and the Chamber of Secrets]] is the second.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]); // CRITICAL: No cream for series search
        expect(result.greenBadgeBooks.length).toBeGreaterThan(0);
      });
    });

    describe("1B: Chat Follow-up - Harry Potter Series", () => {
      const searchedQuery = "harry potter";
      const searchedBook = null;
      const seriesName = "Harry Potter";

      test("CHAT: should maintain GREEN for Harry Potter books in follow-up", () => {
        const aiResponse = `
          Yes, [[Harry Potter and the Deathly Hallows]] is the final book in the series.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([
          "Harry Potter and the Deathly Hallows",
        ]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("CHAT: should use ORANGE for Tolstoy book when asked in follow-up", () => {
        const aiResponse = `
          [[War and Peace]] is a novel by Leo Tolstoy about Napoleon's invasion of Russia.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["War and Peace"]); // MUST be orange!
      });

      test("CHAT: should use ORANGE for JK Rowling's standalone books", () => {
        const aiResponse = `
          J.K. Rowling also wrote standalone books like [[The Ickabog]] and [[The Casual Vacancy]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining(["The Ickabog", "The Casual Vacancy"]),
        );
      });

      test("CHAT: should use ORANGE for books from different series", () => {
        const aiResponse = `
          If you like Harry Potter, you might enjoy [[The Fellowship of the Ring]] from The Lord of the Rings.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["The Fellowship of the Ring"]);
      });

      test("CHAT: mixed colors - GREEN for HP books, ORANGE for others", () => {
        const aiResponse = `
          [[Harry Potter and the Philosopher's Stone]] is similar to [[The Lion, the Witch and the Wardrobe]] and [[The Hobbit]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining([
            "The Lion, the Witch and the Wardrobe",
            "The Hobbit",
          ]),
        );
      });
    });

    describe("1C: Initial Search Response - Lord of the Rings Series", () => {
      const searchedQuery = "lord of the rings";
      const searchedBook = null;
      const seriesName = "The Lord of the Rings";

      test("should use GREEN for books in LOTR series", () => {
        const aiResponse = `
          The Lord of the Rings trilogy includes:
          [[The Fellowship of the Ring]]
          [[The Two Towers]]
          [[The Return of the King]]
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual(
          expect.arrayContaining([
            "The Fellowship of the Ring",
            "The Two Towers",
            "The Return of the King",
          ]),
        );
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for Tolkien books NOT in LOTR series", () => {
        const aiResponse = `
          [[The Fellowship of the Ring]] is part of the trilogy.
          Tolkien also wrote [[The Hobbit]] and [[The Silmarillion]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual(["The Fellowship of the Ring"]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining(["The Hobbit", "The Silmarillion"]),
        );
      });
    });

    describe("1D: Chat Follow-up - Lord of the Rings Series", () => {
      const searchedQuery = "lord of the rings";
      const searchedBook = null;
      const seriesName = "The Lord of the Rings";

      test("CHAT: should use ORANGE for War and Peace", () => {
        const aiResponse = `
          [[War and Peace]] is a novel by Leo Tolstoy, set against Napoleon's invasion of Russia.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["War and Peace"]); // BUG FIX: This MUST be orange!
      });

      test("CHAT: should use ORANGE for Anna Karenina", () => {
        const aiResponse = `
          [[Anna Karenina]] is another novel by Tolstoy about Russian aristocratic families.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["Anna Karenina"]);
      });

      test("CHAT: should use GREEN for LOTR books, ORANGE for others", () => {
        const aiResponse = `
          [[The Two Towers]] is the second book. If you like it, try [[The Hobbit]] or [[A Game of Thrones]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual(["The Two Towers"]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining(["The Hobbit", "A Game of Thrones"]),
        );
      });
    });

    describe("1E: Initial Search Response - The Hunger Games Series", () => {
      const searchedQuery = "the hunger games";
      const searchedBook = null;
      const seriesName = "The Hunger Games";

      test("should use GREEN for books in Hunger Games series", () => {
        const aiResponse = `
          The series includes:
          [[The Hunger Games]]
          [[Catching Fire]]
          [[Mockingjay]]
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual(
          expect.arrayContaining([
            "The Hunger Games",
            "Catching Fire",
            "Mockingjay",
          ]),
        );
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for dystopian books from different series", () => {
        const aiResponse = `
          [[The Hunger Games]] is similar to [[1984]] and [[Brave New World]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual(["The Hunger Games"]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining(["1984", "Brave New World"]),
        );
      });
    });
  });

  // ============================================================================
  // SCENARIO 2: USER SEARCHED FOR A BOOK IN A SERIES
  // ============================================================================
  describe("SCENARIO 2: User searched for a BOOK IN A SERIES", () => {
    describe("2A: Initial Search - Harry Potter and the Philosopher's Stone", () => {
      const searchedQuery = "harry potter and the philosopher's stone";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      test("should use CREAM for the exact searched book", () => {
        const aiResponse = `
          [[Harry Potter and the Philosopher's Stone]] is the first book in the Harry Potter series.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use GREEN for other books in Harry Potter series", () => {
        const aiResponse = `
          [[Harry Potter and the Philosopher's Stone]] is followed by [[Harry Potter and the Chamber of Secrets]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
        expect(result.greenBadgeBooks).toEqual([
          "Harry Potter and the Chamber of Secrets",
        ]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for JK Rowling's standalone books", () => {
        const aiResponse = `
          [[Harry Potter and the Philosopher's Stone]] is part of the series.
          J.K. Rowling also wrote [[The Ickabog]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["The Ickabog"]);
      });

      test("should correctly classify all three badge colors", () => {
        const aiResponse = `
          [[Harry Potter and the Philosopher's Stone]] is the first book.
          It's followed by [[Harry Potter and the Chamber of Secrets]].
          If you like it, try [[The Lion, the Witch and the Wardrobe]] or [[The Ickabog]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
        expect(result.greenBadgeBooks).toEqual([
          "Harry Potter and the Chamber of Secrets",
        ]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining([
            "The Lion, the Witch and the Wardrobe",
            "The Ickabog",
          ]),
        );
      });
    });

    describe("2B: Chat Follow-up - Harry Potter and the Philosopher's Stone", () => {
      const searchedQuery = "harry potter and the philosopher's stone";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      test("CHAT: should maintain CREAM for the searched book", () => {
        const aiResponse = `
          Yes, [[Harry Potter and the Philosopher's Stone]] introduces Voldemort.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("CHAT: should use GREEN for other HP books", () => {
        const aiResponse = `
          That theme continues in [[Harry Potter and the Goblet of Fire]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([
          "Harry Potter and the Goblet of Fire",
        ]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("CHAT: should use ORANGE for Anna Karenina", () => {
        const aiResponse = `
          [[Anna Karenina]] is a novel by Tolstoy about Russian aristocratic families.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["Anna Karenina"]);
      });

      test("CHAT: should use ORANGE for The Ickabog", () => {
        const aiResponse = `
          J.K. Rowling also wrote [[The Ickabog]], a standalone fairy tale.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["The Ickabog"]);
      });

      test("CHAT: mixed colors in follow-up conversation", () => {
        const aiResponse = `
          [[Harry Potter and the Philosopher's Stone]] is the start.
          [[Harry Potter and the Deathly Hallows]] concludes the series.
          Other fantasy books include [[The Hobbit]] and [[The Lion, the Witch and the Wardrobe]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
        expect(result.greenBadgeBooks).toEqual([
          "Harry Potter and the Deathly Hallows",
        ]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining([
            "The Hobbit",
            "The Lion, the Witch and the Wardrobe",
          ]),
        );
      });
    });

    describe("2C: Initial Search - The Fellowship of the Ring", () => {
      const searchedQuery = "the fellowship of the ring";
      const searchedBook = "The Fellowship of the Ring";
      const seriesName = "The Lord of the Rings";

      test("should use CREAM for The Fellowship of the Ring", () => {
        const aiResponse = `
          [[The Fellowship of the Ring]] is the first book in The Lord of the Rings trilogy.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Fellowship of the Ring"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use GREEN for other LOTR books", () => {
        const aiResponse = `
          [[The Fellowship of the Ring]] is followed by [[The Two Towers]] and [[The Return of the King]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Fellowship of the Ring"]);
        expect(result.greenBadgeBooks).toEqual(
          expect.arrayContaining(["The Two Towers", "The Return of the King"]),
        );
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for The Hobbit", () => {
        const aiResponse = `
          [[The Fellowship of the Ring]] is preceded by [[The Hobbit]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Fellowship of the Ring"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["The Hobbit"]);
      });
    });

    describe("2D: Chat Follow-up - The Fellowship of the Ring", () => {
      const searchedQuery = "the fellowship of the ring";
      const searchedBook = "The Fellowship of the Ring";
      const seriesName = "The Lord of the Rings";

      test("CHAT: should use ORANGE for War and Peace", () => {
        const aiResponse = `
          [[War and Peace]] is a historical novel by Leo Tolstoy.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["War and Peace"]);
      });

      test("CHAT: should use GREEN for The Two Towers", () => {
        const aiResponse = `
          [[The Two Towers]] is the second book in the trilogy.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual(["The Two Towers"]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });
    });

    describe("2E: Initial Search - The Hunger Games (book with same name as series)", () => {
      const searchedQuery = "the hunger games";
      const searchedBook = "The Hunger Games";
      const seriesName = "The Hunger Games";

      test("should use CREAM for The Hunger Games (the book)", () => {
        const aiResponse = `
          [[The Hunger Games]] is a dystopian novel by Suzanne Collins.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Hunger Games"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use GREEN for sequels in the series", () => {
        const aiResponse = `
          [[The Hunger Games]] is followed by [[Catching Fire]] and [[Mockingjay]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Hunger Games"]);
        expect(result.greenBadgeBooks).toEqual(
          expect.arrayContaining(["Catching Fire", "Mockingjay"]),
        );
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for other dystopian books", () => {
        const aiResponse = `
          [[The Hunger Games]] is similar to [[1984]] and [[Brave New World]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Hunger Games"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining(["1984", "Brave New World"]),
        );
      });
    });
  });

  // ============================================================================
  // SCENARIO 3: USER SEARCHED FOR A STANDALONE BOOK
  // ============================================================================
  describe("SCENARIO 3: User searched for a STANDALONE BOOK (not part of a series)", () => {
    describe("3A: Initial Search - Anna Karenina", () => {
      const searchedQuery = "anna karenina";
      const searchedBook = "Anna Karenina";
      const seriesName = null; // Not part of a series

      test("should use CREAM for Anna Karenina", () => {
        const aiResponse = `
          [[Anna Karenina]] is a novel by Leo Tolstoy about Russian aristocratic families.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["Anna Karenina"]);
        expect(result.greenBadgeBooks).toEqual([]); // GREEN never used for standalone
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for other Tolstoy books", () => {
        const aiResponse = `
          [[Anna Karenina]] is one of Tolstoy's masterpieces. He also wrote [[War and Peace]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["Anna Karenina"]);
        expect(result.greenBadgeBooks).toEqual([]); // GREEN never used
        expect(result.orangeBadgeBooks).toEqual(["War and Peace"]);
      });

      test("should NEVER use GREEN (standalone book has no series)", () => {
        const aiResponse = `
          [[Anna Karenina]] explores themes of love and society.
          Similar classics include [[Madame Bovary]] and [[Pride and Prejudice]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["Anna Karenina"]);
        expect(result.greenBadgeBooks).toEqual([]); // CRITICAL: Never green for standalone
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining(["Madame Bovary", "Pride and Prejudice"]),
        );
      });
    });

    describe("3B: Chat Follow-up - Anna Karenina", () => {
      const searchedQuery = "anna karenina";
      const searchedBook = "Anna Karenina";
      const seriesName = null;

      test("CHAT: should maintain CREAM for Anna Karenina", () => {
        const aiResponse = `
          Yes, [[Anna Karenina]] explores the theme of adultery.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["Anna Karenina"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("CHAT: should use ORANGE for War and Peace", () => {
        const aiResponse = `
          Tolstoy also wrote [[War and Peace]], another epic novel.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]); // GREEN never used
        expect(result.orangeBadgeBooks).toEqual(["War and Peace"]);
      });

      test("CHAT: should use ORANGE for Harry Potter books", () => {
        const aiResponse = `
          Other famous books include [[Harry Potter and the Philosopher's Stone]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual([]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
      });

      test("CHAT: should NEVER use GREEN in any follow-up", () => {
        const aiResponse = `
          [[Anna Karenina]] is similar to [[Madame Bovary]], [[The Great Gatsby]], and [[Pride and Prejudice]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["Anna Karenina"]);
        expect(result.greenBadgeBooks).toEqual([]); // CRITICAL: Never green
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining([
            "Madame Bovary",
            "The Great Gatsby",
            "Pride and Prejudice",
          ]),
        );
      });
    });

    describe("3C: Initial Search - 1984", () => {
      const searchedQuery = "1984";
      const searchedBook = "1984";
      const seriesName = null;

      test("should use CREAM for 1984", () => {
        const aiResponse = `
          [[1984]] is a dystopian novel by George Orwell.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["1984"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for other dystopian books", () => {
        const aiResponse = `
          [[1984]] is similar to [[Brave New World]] and [[Fahrenheit 451]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["1984"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(
          expect.arrayContaining(["Brave New World", "Fahrenheit 451"]),
        );
      });

      test("should NEVER use GREEN", () => {
        const aiResponse = `
          [[1984]] and [[Animal Farm]] are both by George Orwell.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["1984"]);
        expect(result.greenBadgeBooks).toEqual([]); // Never green for standalone
        expect(result.orangeBadgeBooks).toEqual(["Animal Farm"]);
      });
    });

    describe("3D: Chat Follow-up - 1984", () => {
      const searchedQuery = "1984";
      const searchedBook = "1984";
      const seriesName = null;

      test("CHAT: should use ORANGE for The Hunger Games", () => {
        const aiResponse = `
          If you like [[1984]], you might enjoy [[The Hunger Games]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["1984"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["The Hunger Games"]);
      });

      test("CHAT: should use ORANGE for Lord of the Rings books", () => {
        const aiResponse = `
          Fantasy books like [[The Fellowship of the Ring]] are different from [[1984]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["1984"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["The Fellowship of the Ring"]);
      });
    });

    describe("3E: Initial Search - The Ickabog", () => {
      const searchedQuery = "the ickabog";
      const searchedBook = "The Ickabog";
      const seriesName = null;

      test("should use CREAM for The Ickabog", () => {
        const aiResponse = `
          [[The Ickabog]] is a fairy tale by J.K. Rowling.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Ickabog"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual([]);
      });

      test("should use ORANGE for Harry Potter books", () => {
        const aiResponse = `
          [[The Ickabog]] is different from J.K. Rowling's [[Harry Potter and the Philosopher's Stone]].
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Ickabog"]);
        expect(result.greenBadgeBooks).toEqual([]); // Never green
        expect(result.orangeBadgeBooks).toEqual([
          "Harry Potter and the Philosopher's Stone",
        ]);
      });

      test("should NEVER use GREEN", () => {
        const aiResponse = `
          [[The Ickabog]] and [[The Casual Vacancy]] are standalone J.K. Rowling books.
        `;

        const result = classifyBookBadges(
          aiResponse,
          searchedQuery,
          searchedBook,
          seriesName,
        );

        expect(result.creamBadgeBooks).toEqual(["The Ickabog"]);
        expect(result.greenBadgeBooks).toEqual([]);
        expect(result.orangeBadgeBooks).toEqual(["The Casual Vacancy"]);
      });
    });
  });

  // ============================================================================
  // EDGE CASES & COMPLEX SCENARIOS
  // ============================================================================
  describe("EDGE CASES & COMPLEX SCENARIOS", () => {
    test("should handle unknown books (not in database)", () => {
      const searchedQuery = "some unknown book";
      const searchedBook = "Some Unknown Book";
      const seriesName = null;

      const aiResponse = `
        [[Some Unknown Book]] is a great read. Similar books include [[Another Unknown Book]].
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual(["Some Unknown Book"]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual(["Another Unknown Book"]);
    });

    test("should handle multiple mentions of the same book", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      const aiResponse = `
        [[Harry Potter and the Philosopher's Stone]] is great.
        I love [[Harry Potter and the Philosopher's Stone]].
        [[Harry Potter and the Philosopher's Stone]] is the first book.
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // Should not create duplicates
      expect(result.creamBadgeBooks).toEqual([
        "Harry Potter and the Philosopher's Stone",
      ]);
    });

    test("should handle mixed scenarios with all three badge colors", () => {
      const searchedQuery = "harry potter and the philosopher's stone";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      const aiResponse = `
        [[Harry Potter and the Philosopher's Stone]] is the first.
        [[Harry Potter and the Chamber of Secrets]] is the second.
        [[Harry Potter and the Goblet of Fire]] is the fourth.
        Other books include [[The Ickabog]], [[1984]], and [[The Fellowship of the Ring]].
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual([
        "Harry Potter and the Philosopher's Stone",
      ]);
      expect(result.greenBadgeBooks).toEqual(
        expect.arrayContaining([
          "Harry Potter and the Chamber of Secrets",
          "Harry Potter and the Goblet of Fire",
        ]),
      );
      expect(result.orangeBadgeBooks).toEqual(
        expect.arrayContaining([
          "The Ickabog",
          "1984",
          "The Fellowship of the Ring",
        ]),
      );
    });

    test("should NOT badge series names even when wrapped", () => {
      const searchedQuery = "harry potter";
      const searchedBook = null;
      const seriesName = "Harry Potter";

      const aiResponse = `
        The [[Harry Potter]] series includes seven books.
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // "Harry Potter" followed by "series" should not be badged
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should handle case-insensitive matching", () => {
      const searchedQuery = "HARRY POTTER AND THE PHILOSOPHER'S STONE";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      const aiResponse = `
        [[harry potter and the philosopher's stone]] is the first book.
        [[HARRY POTTER AND THE CHAMBER OF SECRETS]] is the second.
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // Should match despite different cases
      expect(result.creamBadgeBooks.length).toBe(1);
      expect(result.greenBadgeBooks.length).toBe(1);
    });

    test("should handle empty or null responses", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      const result = classifyBookBadges(
        null,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should handle response with no wrapped books", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      const aiResponse =
        "Harry Potter is a great series by J.K. Rowling with seven books.";

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });
  });

  // ============================================================================
  // APPLY COLORED BADGES (HTML OUTPUT)
  // ============================================================================
  describe("applyColoredBadges - HTML Output", () => {
    test("should apply correct badge HTML for all three colors", () => {
      const aiResponse = `
        [[Book A]], [[Book B]], and [[Book C]].
      `;

      const classification = {
        creamBadgeBooks: ["Book A"],
        greenBadgeBooks: ["Book B"],
        orangeBadgeBooks: ["Book C"],
      };

      const result = applyColoredBadges(aiResponse, classification);

      expect(result).toContain('class="book-badge book-badge-cream">Book A');
      expect(result).toContain('class="book-badge book-badge-green">Book B');
      expect(result).toContain('class="book-badge book-badge-orange">Book C');
    });

    test("should NOT badge series names followed by 'series' keyword", () => {
      const aiResponse = `
        The [[Harry Potter]] series includes seven books.
      `;

      const classification = {
        creamBadgeBooks: [],
        greenBadgeBooks: [],
        orangeBadgeBooks: [],
      };

      const result = applyColoredBadges(aiResponse, classification);

      // Should not have badge HTML for "Harry Potter"
      expect(result).not.toContain('class="book-badge');
      expect(result).toContain("Harry Potter series");
    });
  });
});
