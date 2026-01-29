/**
 * Comprehensive Unit Tests for Colored Book Badging System
 *
 * FEATURE: Smart badge coloring based on book relationships
 * - CREAM: Exact book searched by user
 * - GREEN: Books in same series as searched book
 * - ORANGE: Unrelated books (different series or standalone)
 *
 * CRITICAL RULE: Series names should NEVER be badged in ANY color
 */

const {
  classifyBookBadges,
  getSeriesInfo,
  normalizeBookTitle,
  applyColoredBadges,
  extractBooksWithRelationships,
  isSeriesQuery,
} = require("../utils/coloredBadgeDetector");

describe("Colored Book Badging System", () => {
  // ============================================================================
  // CRITICAL: SERIES NAMES SHOULD NEVER BE BADGED
  // ============================================================================
  describe("CRITICAL: Series names should NEVER be badged in ANY context", () => {
    test("should NOT badge series name when it's the answer to a question (even if AI incorrectly wraps it)", () => {
      const searchedQuery = "harry potter";
      const searchedBook = null;
      const seriesName = "Harry Potter";

      // BUG SCENARIO: User asks: "What is the J.K. Rowling's detective series called?"
      // AI incorrectly wraps "Cormoran Strike" even though it's a SERIES NAME
      // The system should detect this and NOT badge it
      const aiResponse =
        "J.K. Rowling's detective series is called [[Cormoran Strike]].";

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // BUG: "Cormoran Strike" is a series name and should NOT be badged
      // Currently it gets badged as orange, but it should not be badged at all
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]); // THIS CURRENTLY FAILS - Cormoran Strike gets badged orange
    });

    test("should NOT badge series name when it's unwrapped (correct AI behavior)", () => {
      const searchedQuery = "harry potter";
      const searchedBook = null;
      const seriesName = "Harry Potter";

      // CORRECT: AI doesn't wrap "Cormoran Strike" because it's a series name
      const aiResponse =
        "J.K. Rowling's detective series is called Cormoran Strike.";

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // NO books should be classified since "Cormoran Strike" is NOT wrapped
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should NOT badge series name in follow-up questions (even if AI incorrectly wraps it)", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // BUG SCENARIO: User previously searched for Harry Potter
      // Then asks: "What is the J.K. Rowling's detective series called?"
      // AI incorrectly wraps "Cormoran Strike" even though it's a series name
      const aiResponse = "The detective series is called [[Cormoran Strike]].";

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // BUG: "Cormoran Strike" should NOT be badged even though it's wrapped
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]); // THIS CURRENTLY FAILS
    });

    test("should NOT badge series name in follow-up questions (correct AI behavior)", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // CORRECT: AI doesn't wrap series name
      const aiResponse = "The detective series is called Cormoran Strike.";

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // NO books should be classified
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should NOT badge series names when listing multiple series (even if AI wraps them)", () => {
      const searchedQuery = "fantasy series";
      const searchedBook = null;
      const seriesName = null;

      // BUG SCENARIO: User asks about fantasy series
      // AI incorrectly wraps series names
      const aiResponse = `
        Popular fantasy series include:
        - [[Harry Potter]]
        - [[The Lord of the Rings]]
        - [[The Chronicles of Narnia]]
        - [[A Song of Ice and Fire]]
        - [[The Wheel of Time]]
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // BUG: These are series names and should NOT be badged
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]); // THIS CURRENTLY FAILS - all get badged orange
    });

    test("should NOT badge series names when listing multiple series (correct behavior)", () => {
      const searchedQuery = "fantasy series";
      const searchedBook = null;
      const seriesName = null;

      // CORRECT: AI doesn't wrap series names
      const aiResponse = `
        Popular fantasy series include:
        - Harry Potter
        - The Lord of the Rings
        - The Chronicles of Narnia
        - A Song of Ice and Fire
        - The Wheel of Time
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // NO books should be classified since these are series names
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should NOT badge 'Harry Potter' when used as series reference (not book)", () => {
      const searchedQuery = "harry potter";
      const searchedBook = null;
      const seriesName = "Harry Potter";

      // "Harry Potter" here refers to the series, not a specific book
      const aiResponse = "Harry Potter is a series of seven fantasy novels.";

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // Should NOT be badged since it's a series reference
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should NOT badge series name when mentioned alongside book titles", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // Mix of series name and book title - only book title should be badged
      const aiResponse = `
        The Harry Potter series starts with [[Harry Potter and the Philosopher's Stone]].
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // Only the actual book title should be badged
      expect(result.creamBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should NOT badge 'The Hunger Games' when used as series name (even if wrapped)", () => {
      const searchedQuery = "dystopian fiction";
      const searchedBook = null;
      const seriesName = null;

      // BUG: AI wraps "The Hunger Games" when referring to the series (not the book)
      const aiResponse = "[[The Hunger Games]] is a popular dystopian series.";

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // BUG: When followed by "series", this should NOT be badged
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]); // THIS CURRENTLY FAILS
    });

    test("should NOT badge 'Lord of the Rings' when used as series reference (even if wrapped)", () => {
      const searchedQuery = "tolkien";
      const searchedBook = null;
      const seriesName = null;

      // BUG: AI wraps "Lord of the Rings" when referring to the series
      const aiResponse = "[[Lord of the Rings]] is an epic fantasy trilogy.";

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // BUG: This is a series reference and should NOT be badged
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]); // THIS CURRENTLY FAILS
    });

    test("should NOT badge other J.K. Rowling series names", () => {
      const searchedQuery = "jk rowling books";
      const searchedBook = null;
      const seriesName = null;

      // BUG: AI wraps series names when listing JKR's works
      const aiResponse = `
        J.K. Rowling has written several series:
        - [[Harry Potter]] series
        - [[Cormoran Strike]] detective series
        - Standalone books like [[The Casual Vacancy]]
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // BUG: "Harry Potter" and "Cormoran Strike" are series names
      // Only "The Casual Vacancy" is an actual book title
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toContain("The Casual Vacancy");
      expect(result.orangeBadgeBooks).toHaveLength(1); // THIS CURRENTLY FAILS - all 3 get badged
    });

    test("should badge The Ickabog as orange in follow-up after Harry Potter search", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // User searched for Harry Potter, then asks about The Ickabog in follow-up
      // The Ickabog is NOT part of Harry Potter series, so should be ORANGE
      const aiResponse = '"The Ickabog" is a fairy tale book by J.K. Rowling.';

      // AI should wrap it: [[The Ickabog]]
      const wrappedResponse =
        "[[The Ickabog]] is a fairy tale book by J.K. Rowling.";

      const result = classifyBookBadges(
        wrappedResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // The Ickabog should be ORANGE (unrelated to HP series)
      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toContain("The Ickabog");
      expect(result.orangeBadgeBooks).toHaveLength(1);
    });

    test("FIXED: The Ickabog now badged even when AI forgets [[brackets]] - exact screenshot scenario", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // EXACT TEXT FROM SCREENSHOT: AI mentions The Ickabog in quotes without [[brackets]]
      // FIXED: Fallback detection now catches quoted titles
      const aiResponseNoBrackets =
        '"The Ickabog" by J.K. Rowling is a fairy tale book aimed at children. It tells the story of the kingdom of Cornucopia, where the fearsome monster, the Ickabog, is said to threaten the land. The book explores themes of power, truth, and the bravery of ordinary people.';

      const resultNoBrackets = classifyBookBadges(
        aiResponseNoBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // FIXED: Now detects "The Ickabog" in quotes and badges it orange
      expect(resultNoBrackets.creamBadgeBooks).toEqual([]);
      expect(resultNoBrackets.greenBadgeBooks).toEqual([]);
      expect(resultNoBrackets.orangeBadgeBooks).toContain("The Ickabog"); // NOW WORKS!

      // CORRECT BEHAVIOR: With brackets also works
      const aiResponseWithBrackets =
        "[[The Ickabog]] by J.K. Rowling is a fairy tale book aimed at children. It tells the story of the kingdom of Cornucopia, where the fearsome monster, the Ickabog, is said to threaten the land. The book explores themes of power, truth, and the bravery of ordinary people.";

      const resultWithBrackets = classifyBookBadges(
        aiResponseWithBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(resultWithBrackets.orangeBadgeBooks).toContain("The Ickabog");
    });

    test("FIXED: The Casual Vacancy now badged even when AI forgets [[brackets]]", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // FIXED: The Casual Vacancy mentioned in quotes without brackets
      const aiResponseNoBrackets =
        '"The Casual Vacancy" is an adult novel by J.K. Rowling, set in a small English town.';

      const resultNoBrackets = classifyBookBadges(
        aiResponseNoBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // FIXED: Now detects quoted title and badges it orange
      expect(resultNoBrackets.orangeBadgeBooks).toContain("The Casual Vacancy");

      // Also works with brackets
      const aiResponseWithBrackets =
        "[[The Casual Vacancy]] is an adult novel by J.K. Rowling, set in a small English town.";

      const resultWithBrackets = classifyBookBadges(
        aiResponseWithBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(resultWithBrackets.orangeBadgeBooks).toContain(
        "The Casual Vacancy",
      );
    });

    test("FIXED: The Christmas Pig now badged even when AI forgets [[brackets]]", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // FIXED: Another JKR standalone mentioned in quotes without brackets
      const aiResponseNoBrackets =
        "\"The Christmas Pig\" is a children's book by J.K. Rowling about a boy's beloved toy.";

      const resultNoBrackets = classifyBookBadges(
        aiResponseNoBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // FIXED: Now detects quoted title and badges it orange
      expect(resultNoBrackets.orangeBadgeBooks).toContain("The Christmas Pig");

      // Also works with brackets
      const aiResponseWithBrackets =
        "[[The Christmas Pig]] is a children's book by J.K. Rowling about a boy's beloved toy.";

      const resultWithBrackets = classifyBookBadges(
        aiResponseWithBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(resultWithBrackets.orangeBadgeBooks).toContain(
        "The Christmas Pig",
      );
    });

    test("FIXED: Fantastic Beasts now badged even when AI forgets [[brackets]]", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // FIXED: Fantastic Beasts is in the HP universe but different series
      const aiResponseNoBrackets =
        '"Fantastic Beasts and Where to Find Them" is a companion book set in the Harry Potter universe.';

      const resultNoBrackets = classifyBookBadges(
        aiResponseNoBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // FIXED: Now detects quoted title and badges it orange (different series)
      expect(resultNoBrackets.orangeBadgeBooks).toContain(
        "Fantastic Beasts and Where to Find Them",
      );

      // Also works with brackets
      const aiResponseWithBrackets =
        "[[Fantastic Beasts and Where to Find Them]] is a companion book set in the Harry Potter universe.";

      const resultWithBrackets = classifyBookBadges(
        aiResponseWithBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(resultWithBrackets.orangeBadgeBooks).toContain(
        "Fantastic Beasts and Where to Find Them",
      );
    });

    test("FIXED: Multiple JKR books now badged even when AI forgets [[brackets]]", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // FIXED: AI lists multiple JKR works in quotes without brackets
      const aiResponseNoBrackets =
        'J.K. Rowling has written many books including "The Ickabog", "The Casual Vacancy", and "The Christmas Pig" outside of the Harry Potter series.';

      const resultNoBrackets = classifyBookBadges(
        aiResponseNoBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // FIXED: Now detects all quoted titles and badges them orange
      expect(resultNoBrackets.orangeBadgeBooks).toContain("The Ickabog");
      expect(resultNoBrackets.orangeBadgeBooks).toContain("The Casual Vacancy");
      expect(resultNoBrackets.orangeBadgeBooks).toContain("The Christmas Pig");
      expect(resultNoBrackets.orangeBadgeBooks).toHaveLength(3);

      // Also works with brackets
      const aiResponseWithBrackets =
        "J.K. Rowling has written many books including [[The Ickabog]], [[The Casual Vacancy]], and [[The Christmas Pig]] outside of the Harry Potter series.";

      const resultWithBrackets = classifyBookBadges(
        aiResponseWithBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(resultWithBrackets.orangeBadgeBooks).toContain("The Ickabog");
      expect(resultWithBrackets.orangeBadgeBooks).toContain(
        "The Casual Vacancy",
      );
      expect(resultWithBrackets.orangeBadgeBooks).toContain(
        "The Christmas Pig",
      );
      expect(resultWithBrackets.orangeBadgeBooks).toHaveLength(3);
    });

    test("FIXED: The Ickabog with italics markdown now recognized", () => {
      const searchedQuery = "harry potter";
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // FIXED: AI uses markdown italics instead of [[brackets]]
      const aiResponseWithItalics =
        "*The Ickabog* by J.K. Rowling is a fairy tale book aimed at children.";

      const resultWithItalics = classifyBookBadges(
        aiResponseWithItalics,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // FIXED: Italics are now recognized as book title markers
      expect(resultWithItalics.orangeBadgeBooks).toContain("The Ickabog");

      // Also works with brackets
      const aiResponseWithBrackets =
        "[[The Ickabog]] by J.K. Rowling is a fairy tale book aimed at children.";

      const resultWithBrackets = classifyBookBadges(
        aiResponseWithBrackets,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(resultWithBrackets.orangeBadgeBooks).toContain("The Ickabog");
    });

    test("should distinguish between series name and book title with same root", () => {
      const searchedQuery = "the hunger games";
      const searchedBook = "The Hunger Games"; // This is the first book title
      const seriesName = "The Hunger Games";

      // "The Hunger Games" as book title (first book) vs series name
      const aiResponse = `
        [[The Hunger Games]] is the first book in The Hunger Games series.
        The series also includes [[Catching Fire]] and [[Mockingjay]].
      `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // Only the wrapped instances should be badged (book titles)
      expect(result.creamBadgeBooks).toContain("The Hunger Games");
      expect(result.greenBadgeBooks).toContain("Catching Fire");
      expect(result.greenBadgeBooks).toContain("Mockingjay");
      // Total should be 3 books, not 4 (series mention shouldn't be counted)
      expect(
        result.creamBadgeBooks.length +
          result.greenBadgeBooks.length +
          result.orangeBadgeBooks.length,
      ).toBe(3);
    });
  });

  // ============================================================================
  // SCENARIO 1: User Searches for SERIES NAME
  // ============================================================================
  describe('SCENARIO 1: Search for Series Name (e.g., "harry potter")', () => {
    const searchedQuery = "harry potter";
    const searchedBook = null; // No specific book, just series name
    const seriesName = "Harry Potter";

    test("should NOT assign cream badge when searching for series name", () => {
      const aiResponse = `
                The Harry Potter series includes these books:
                [[Harry Potter and the Philosopher's Stone]]
                [[Harry Potter and the Chamber of Secrets]]
                [[Harry Potter and the Prisoner of Azkaban]]
                [[The Ickabog]]
                [[Anna Karenina]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // No cream badges since no specific book was searched
      expect(result.creamBadgeBooks).toEqual([]);
    });

    test("should assign GREEN badges to all Harry Potter series books", () => {
      const aiResponse = `
                The Harry Potter series includes:
                [[Harry Potter and the Philosopher's Stone]]
                [[Harry Potter and the Chamber of Secrets]]
                [[Harry Potter and the Prisoner of Azkaban]]
                [[Harry Potter and the Goblet of Fire]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Prisoner of Azkaban",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Goblet of Fire",
      );
      expect(result.greenBadgeBooks).toHaveLength(4);
    });

    test("should assign ORANGE badges to unrelated books", () => {
      const aiResponse = `
                Harry Potter series: [[Harry Potter and the Philosopher's Stone]]
                Other books by JK Rowling: [[The Ickabog]], [[The Christmas Pig]]
                Similar fantasy: [[The Chronicles of Narnia: The Lion, the Witch and the Wardrobe]]
                Classic literature: [[Anna Karenina]], [[War and Peace]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.orangeBadgeBooks).toContain("The Ickabog");
      expect(result.orangeBadgeBooks).toContain("The Christmas Pig");
      expect(result.orangeBadgeBooks).toContain(
        "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe",
      );
      expect(result.orangeBadgeBooks).toContain("Anna Karenina");
      expect(result.orangeBadgeBooks).toContain("War and Peace");
    });

    test("should correctly classify mixed book list when searching series name", () => {
      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]]
                [[Harry Potter and the Chamber of Secrets]]
                [[The Ickabog]]
                [[Anna Karenina]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toHaveLength(2);
      expect(result.orangeBadgeBooks).toHaveLength(2);
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
      expect(result.orangeBadgeBooks).toContain("The Ickabog");
      expect(result.orangeBadgeBooks).toContain("Anna Karenina");
    });

    test("should handle all 7 Harry Potter books correctly", () => {
      const aiResponse = `
                The complete Harry Potter series:
                1. [[Harry Potter and the Philosopher's Stone]]
                2. [[Harry Potter and the Chamber of Secrets]]
                3. [[Harry Potter and the Prisoner of Azkaban]]
                4. [[Harry Potter and the Goblet of Fire]]
                5. [[Harry Potter and the Order of the Phoenix]]
                6. [[Harry Potter and the Half-Blood Prince]]
                7. [[Harry Potter and the Deathly Hallows]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.greenBadgeBooks).toHaveLength(7);
      expect(result.creamBadgeBooks).toHaveLength(0);
      expect(result.orangeBadgeBooks).toHaveLength(0);
    });
  });

  // ============================================================================
  // SCENARIO 2: User Searches for BOOK IN A SERIES
  // ============================================================================
  describe('SCENARIO 2: Search for Book in Series (e.g., "Harry Potter and the Philosopher\'s Stone")', () => {
    const searchedQuery = "Harry Potter and the Philosopher's Stone";
    const searchedBook = "Harry Potter and the Philosopher's Stone";
    const seriesName = "Harry Potter";

    test("should assign CREAM badge ONLY to the exact searched book", () => {
      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]] is the first book.
                Followed by [[Harry Potter and the Chamber of Secrets]].
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
      expect(result.creamBadgeBooks).toHaveLength(1);
    });

    test("should assign GREEN badges to other Harry Potter series books", () => {
      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]]
                [[Harry Potter and the Chamber of Secrets]]
                [[Harry Potter and the Prisoner of Azkaban]]
                [[Harry Potter and the Goblet of Fire]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Prisoner of Azkaban",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Goblet of Fire",
      );
      expect(result.greenBadgeBooks).not.toContain(
        "Harry Potter and the Philosopher's Stone",
      );
    });

    test("should assign ORANGE badges to unrelated books", () => {
      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]]
                [[Harry Potter and the Chamber of Secrets]]
                [[The Ickabog]]
                [[Anna Karenina]]
                [[War and Peace]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.orangeBadgeBooks).toContain("The Ickabog");
      expect(result.orangeBadgeBooks).toContain("Anna Karenina");
      expect(result.orangeBadgeBooks).toContain("War and Peace");
    });

    test("should correctly classify all badge types together", () => {
      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]] - First book
                [[Harry Potter and the Chamber of Secrets]] - Second book
                [[Harry Potter and the Goblet of Fire]] - Fourth book
                [[The Ickabog]] - JK Rowling's standalone
                [[Anna Karenina]] - Tolstoy classic
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
      expect(result.greenBadgeBooks).toHaveLength(2);
      expect(result.orangeBadgeBooks).toHaveLength(2);
    });

    test("should handle same book mentioned multiple times - all get cream badge", () => {
      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]] was first published in 1997.
                In [[Harry Potter and the Philosopher's Stone]], we meet Harry for the first time.
                The adventure begins with [[Harry Potter and the Philosopher's Stone]].
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      // Even if mentioned 3 times, it should appear once in the array
      expect(result.creamBadgeBooks).toEqual([
        "Harry Potter and the Philosopher's Stone",
      ]);
    });

    test("should handle searching for the LAST book in series", () => {
      const searchedLast = "Harry Potter and the Deathly Hallows";
      const aiResponse = `
                [[Harry Potter and the Deathly Hallows]] concludes the series.
                Previous books include [[Harry Potter and the Half-Blood Prince]].
                And [[Harry Potter and the Order of the Phoenix]].
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedLast,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual([
        "Harry Potter and the Deathly Hallows",
      ]);
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Half-Blood Prince",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Order of the Phoenix",
      );
    });
  });

  // ============================================================================
  // SCENARIO 3: User Searches for STANDALONE BOOK
  // ============================================================================
  describe('SCENARIO 3: Search for Standalone Book (e.g., "Anna Karenina")', () => {
    const searchedQuery = "anna karenina";
    const searchedBook = "Anna Karenina";
    const seriesName = null; // Standalone book has no series

    test("should assign CREAM badge to the standalone book", () => {
      const aiResponse = `
                [[Anna Karenina]] is a classic Russian novel by Leo Tolstoy.
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual(["Anna Karenina"]);
    });

    test("should NOT assign any GREEN badges for standalone book", () => {
      const aiResponse = `
                [[Anna Karenina]]
                [[War and Peace]]
                [[The Death of Ivan Ilyich]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toHaveLength(0);
    });

    test("should assign ORANGE badges to ALL other books mentioned", () => {
      const aiResponse = `
                [[Anna Karenina]] by Leo Tolstoy
                Other Tolstoy works: [[War and Peace]], [[The Death of Ivan Ilyich]]
                Similar classics: [[Madame Bovary]], [[Pride and Prejudice]]
                Fantasy: [[Harry Potter and the Philosopher's Stone]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.orangeBadgeBooks).toContain("War and Peace");
      expect(result.orangeBadgeBooks).toContain("The Death of Ivan Ilyich");
      expect(result.orangeBadgeBooks).toContain("Madame Bovary");
      expect(result.orangeBadgeBooks).toContain("Pride and Prejudice");
      expect(result.orangeBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.orangeBadgeBooks).toHaveLength(5);
    });

    test("should handle same author different works (all orange except searched)", () => {
      const aiResponse = `
                [[Anna Karenina]] is Tolstoy's most famous work.
                He also wrote [[War and Peace]], [[Resurrection]], and [[The Kreutzer Sonata]].
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual(["Anna Karenina"]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toContain("War and Peace");
      expect(result.orangeBadgeBooks).toContain("Resurrection");
      expect(result.orangeBadgeBooks).toContain("The Kreutzer Sonata");
    });
  });

  // ============================================================================
  // ADDITIONAL TEST CASES: Title Normalization
  // ============================================================================
  describe("Title Normalization Integration", () => {
    test('should normalize "48 laws of power" to "The 48 Laws of Power"', () => {
      const normalized = normalizeBookTitle("48 laws of power");
      expect(normalized).toBe("The 48 Laws of Power");
    });

    test('should normalize "harry potter philosopher stone" to full title', () => {
      const normalized = normalizeBookTitle("harry potter philosopher stone");
      expect(normalized).toBe("Harry Potter and the Philosopher's Stone");
    });

    test('should handle title with "the" already present', () => {
      const normalized = normalizeBookTitle("the great gatsby");
      expect(normalized).toBe("The Great Gatsby");
    });

    test("should correct common misspellings", () => {
      const normalized = normalizeBookTitle("lord of the rings");
      // Should normalize to first book in series
      expect(normalized).toBe("The Fellowship of the Ring");
    });

    test("should handle lowercase search and compare correctly", () => {
      const searchedQuery = "anna karenina";
      const searchedBook = "Anna Karenina";

      const aiResponse = `
                [[Anna Karenina]] is a masterpiece.
                [[War and Peace]] is another Tolstoy work.
            `;

      const result = classifyBookBadges(
        aiResponse,
        searchedQuery,
        searchedBook,
        null,
      );

      expect(result.creamBadgeBooks).toContain("Anna Karenina");
    });
  });

  // ============================================================================
  // ADDITIONAL TEST CASES: Multi-turn Conversation
  // ============================================================================
  describe("Multi-turn Conversation Scenarios", () => {
    test("should maintain cream badge for original search across turns", () => {
      const searchedBook = "Oliver Twist";
      const seriesName = null;

      // Turn 1: Initial search
      const turn1Response = `[[Oliver Twist]] is a novel by Charles Dickens.`;
      const result1 = classifyBookBadges(
        turn1Response,
        "oliver twist",
        searchedBook,
        seriesName,
      );
      expect(result1.creamBadgeBooks).toContain("Oliver Twist");

      // Turn 2: User asks about another book
      const turn2Response = `
                [[Oliver Twist]] and [[David Copperfield]] are both by Dickens.
                [[David Copperfield]] is another classic.
            `;
      const result2 = classifyBookBadges(
        turn2Response,
        "oliver twist",
        searchedBook,
        seriesName,
      );

      expect(result2.creamBadgeBooks).toContain("Oliver Twist");
      expect(result2.orangeBadgeBooks).toContain("David Copperfield");
    });

    test("should treat other books by same author as orange (not same series)", () => {
      const searchedBook = "Oliver Twist";

      const aiResponse = `
                [[Oliver Twist]] explores themes of poverty.
                Other Dickens novels: [[David Copperfield]], [[Great Expectations]], [[A Tale of Two Cities]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        "oliver twist",
        searchedBook,
        null,
      );

      expect(result.creamBadgeBooks).toContain("Oliver Twist");
      expect(result.orangeBadgeBooks).toContain("David Copperfield");
      expect(result.orangeBadgeBooks).toContain("Great Expectations");
      expect(result.orangeBadgeBooks).toContain("A Tale of Two Cities");
      expect(result.greenBadgeBooks).toHaveLength(0);
    });

    test("should handle follow-up questions about series books", () => {
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      // User asks: "Tell me about the second book"
      const aiResponse = `
                After [[Harry Potter and the Philosopher's Stone]], 
                the series continues with [[Harry Potter and the Chamber of Secrets]].
            `;

      const result = classifyBookBadges(
        aiResponse,
        "philosopher's stone",
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
    });
  });

  // ============================================================================
  // EDGE CASES: Complex Scenarios
  // ============================================================================
  describe("Edge Cases and Complex Scenarios", () => {
    test("should handle same book mentioned multiple times with same badge color", () => {
      const aiResponse = `
                [[1984]] was published in 1949. George Orwell wrote [[1984]] as a warning.
                The themes in [[1984]] remain relevant today.
            `;

      const result = classifyBookBadges(aiResponse, "1984", "1984", null);

      // Should only appear once in cream badges despite 3 mentions
      expect(result.creamBadgeBooks).toEqual(["1984"]);
      expect(result.creamBadgeBooks).toHaveLength(1);
    });

    test("should handle response with books from multiple different series", () => {
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]] - Fantasy series
                [[Harry Potter and the Chamber of Secrets]] - Same series
                [[The Fellowship of the Ring]] - LOTR series
                [[The Two Towers]] - LOTR series
                [[The Hunger Games]] - Different series
            `;

      const result = classifyBookBadges(
        aiResponse,
        "philosopher's stone",
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toEqual([
        "Harry Potter and the Philosopher's Stone",
      ]);
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
      expect(result.orangeBadgeBooks).toContain("The Fellowship of the Ring");
      expect(result.orangeBadgeBooks).toContain("The Two Towers");
      expect(result.orangeBadgeBooks).toContain("The Hunger Games");
    });

    test("should handle response with series name AND specific titles", () => {
      const aiResponse = `
                The Harry Potter series is beloved worldwide.
                It includes [[Harry Potter and the Philosopher's Stone]],
                [[Harry Potter and the Chamber of Secrets]], and five others.
            `;

      const result = classifyBookBadges(
        aiResponse,
        "harry potter",
        null,
        "Harry Potter",
      );

      // Series name should NOT be badged (handled by AI instructions)
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
      expect(
        result.greenBadgeBooks.some((book) => book === "Harry Potter series"),
      ).toBe(false);
    });

    test("should handle book title as part of longer sentence", () => {
      const aiResponse = `
                If you enjoyed [[Harry Potter and the Philosopher's Stone]], 
                you'll love [[Harry Potter and the Chamber of Secrets]].
                The magic continues in [[Harry Potter and the Prisoner of Azkaban]].
            `;

      const result = classifyBookBadges(
        aiResponse,
        "philosopher's stone",
        "Harry Potter and the Philosopher's Stone",
        "Harry Potter",
      );

      expect(result.creamBadgeBooks).toHaveLength(1);
      expect(result.greenBadgeBooks).toHaveLength(2);
    });

    test("should handle case sensitivity in book title matching", () => {
      const aiResponse = `
                [[HARRY POTTER AND THE PHILOSOPHER'S STONE]]
                [[harry potter and the chamber of secrets]]
                [[Harry Potter And The Prisoner Of Azkaban]]
            `;

      const result = classifyBookBadges(
        aiResponse,
        "harry potter philosopher stone",
        "Harry Potter and the Philosopher's Stone",
        "Harry Potter",
      );

      // Should match regardless of case differences
      expect(
        result.creamBadgeBooks.length + result.greenBadgeBooks.length,
      ).toBe(3);
    });
  });

  // ============================================================================
  // EDGE CASE: Same Author, Different Works
  // ============================================================================
  describe("Same Author, Different Works", () => {
    test("should treat JK Rowling standalone as orange when searching HP book", () => {
      const searchedBook = "Harry Potter and the Philosopher's Stone";
      const seriesName = "Harry Potter";

      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]] is JK Rowling's most famous work.
                [[Harry Potter and the Chamber of Secrets]] continues the series.
                She also wrote [[The Ickabog]], a standalone fairy tale.
                And [[The Christmas Pig]], another standalone.
            `;

      const result = classifyBookBadges(
        aiResponse,
        "philosopher's stone",
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
      expect(result.orangeBadgeBooks).toContain("The Ickabog");
      expect(result.orangeBadgeBooks).toContain("The Christmas Pig");
    });

    test("should treat HP books as orange when searching for The Ickabog", () => {
      const searchedBook = "The Ickabog";
      const seriesName = null; // Standalone

      const aiResponse = `
                [[The Ickabog]] is a fairy tale by JK Rowling.
                She's best known for [[Harry Potter and the Philosopher's Stone]].
                And the rest of the series: [[Harry Potter and the Chamber of Secrets]].
            `;

      const result = classifyBookBadges(
        aiResponse,
        "the ickabog",
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toContain("The Ickabog");
      expect(result.greenBadgeBooks).toHaveLength(0);
      expect(result.orangeBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(result.orangeBadgeBooks).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
    });

    test("should handle Tolkien - LOTR vs The Hobbit vs Standalone", () => {
      const searchedBook = "The Fellowship of the Ring";
      const seriesName = "The Lord of the Rings";

      const aiResponse = `
                [[The Fellowship of the Ring]] is the first in the trilogy.
                Followed by [[The Two Towers]] and [[The Return of the King]].
                [[The Hobbit]] is a prequel but separate story.
                [[The Silmarillion]] is a different work entirely.
            `;

      const result = classifyBookBadges(
        aiResponse,
        "fellowship",
        searchedBook,
        seriesName,
      );

      expect(result.creamBadgeBooks).toContain("The Fellowship of the Ring");
      expect(result.greenBadgeBooks).toContain("The Two Towers");
      expect(result.greenBadgeBooks).toContain("The Return of the King");
      expect(result.orangeBadgeBooks).toContain("The Hobbit");
      expect(result.orangeBadgeBooks).toContain("The Silmarillion");
    });
  });

  // ============================================================================
  // SERIES QUERY DETECTION
  // ============================================================================
  describe("Series Query Detection", () => {
    test('should detect "harry potter" as a series query', () => {
      const result = isSeriesQuery("harry potter");
      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("Harry Potter");
    });

    test('should detect "Harry Potter" (capitalized) as a series query', () => {
      const result = isSeriesQuery("Harry Potter");
      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("Harry Potter");
    });

    test('should detect "lord of the rings" as a series query', () => {
      const result = isSeriesQuery("lord of the rings");
      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("The Lord of the Rings");
    });

    test('should detect "lotr" as a series query', () => {
      const result = isSeriesQuery("lotr");
      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("The Lord of the Rings");
    });

    test('should NOT detect "Harry Potter and the Philosopher\'s Stone" as series query', () => {
      const result = isSeriesQuery("Harry Potter and the Philosopher's Stone");
      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe(null);
    });

    test('should NOT detect "anna karenina" as series query', () => {
      const result = isSeriesQuery("anna karenina");
      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe(null);
    });

    test('should NOT detect "1984" as series query', () => {
      const result = isSeriesQuery("1984");
      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe(null);
    });

    test('should detect "hunger games" as a series query', () => {
      const result = isSeriesQuery("hunger games");
      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("The Hunger Games");
    });

    test('should detect "the hunger games" as a series query', () => {
      const result = isSeriesQuery("the hunger games");
      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("The Hunger Games");
    });

    test('should detect "narnia" as a series query', () => {
      const result = isSeriesQuery("narnia");
      expect(result.isSeries).toBe(true);
      expect(result.seriesName).toBe("The Chronicles of Narnia");
    });

    test("should handle empty string", () => {
      const result = isSeriesQuery("");
      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe(null);
    });

    test("should handle null input", () => {
      const result = isSeriesQuery(null);
      expect(result.isSeries).toBe(false);
      expect(result.seriesName).toBe(null);
    });
  });

  // ============================================================================
  // SERIES INFORMATION DETECTION
  // ============================================================================
  describe("Series Information Detection", () => {
    test("should detect Harry Potter series from book title", () => {
      const seriesInfo = getSeriesInfo(
        "Harry Potter and the Philosopher's Stone",
      );

      expect(seriesInfo.seriesName).toBe("Harry Potter");
      expect(seriesInfo.isPartOfSeries).toBe(true);
      expect(seriesInfo.allBooksInSeries).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
      expect(seriesInfo.allBooksInSeries).toContain(
        "Harry Potter and the Chamber of Secrets",
      );
      expect(seriesInfo.allBooksInSeries).toHaveLength(7);
    });

    test("should detect Lord of the Rings series", () => {
      const seriesInfo = getSeriesInfo("The Fellowship of the Ring");

      expect(seriesInfo.seriesName).toBe("The Lord of the Rings");
      expect(seriesInfo.isPartOfSeries).toBe(true);
      expect(seriesInfo.allBooksInSeries).toContain(
        "The Fellowship of the Ring",
      );
      expect(seriesInfo.allBooksInSeries).toContain("The Two Towers");
      expect(seriesInfo.allBooksInSeries).toContain("The Return of the King");
    });

    test("should return null series for standalone books", () => {
      const seriesInfo = getSeriesInfo("Anna Karenina");

      expect(seriesInfo.isPartOfSeries).toBe(false);
      expect(seriesInfo.seriesName).toBe(null);
      expect(seriesInfo.allBooksInSeries).toEqual([]);
    });

    test("should detect The Hunger Games series", () => {
      const seriesInfo = getSeriesInfo("The Hunger Games");

      expect(seriesInfo.seriesName).toBe("The Hunger Games");
      expect(seriesInfo.isPartOfSeries).toBe(true);
      expect(seriesInfo.allBooksInSeries).toContain("The Hunger Games");
      expect(seriesInfo.allBooksInSeries).toContain("Catching Fire");
      expect(seriesInfo.allBooksInSeries).toContain("Mockingjay");
    });
  });

  // ============================================================================
  // BADGE APPLICATION AND HTML GENERATION
  // ============================================================================
  describe("Badge Application and HTML Generation", () => {
    test("should apply cream badge class to searched book", () => {
      const aiResponse =
        "[[Harry Potter and the Philosopher's Stone]] is a classic.";
      const classification = {
        creamBadgeBooks: ["Harry Potter and the Philosopher's Stone"],
        greenBadgeBooks: [],
        orangeBadgeBooks: [],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain('class="book-badge book-badge-cream"');
      expect(html).toContain("Harry Potter and the Philosopher's Stone");
    });

    test("should apply green badge class to series books", () => {
      const aiResponse =
        "[[Harry Potter and the Chamber of Secrets]] is the sequel.";
      const classification = {
        creamBadgeBooks: [],
        greenBadgeBooks: ["Harry Potter and the Chamber of Secrets"],
        orangeBadgeBooks: [],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain('class="book-badge book-badge-green"');
      expect(html).toContain("Harry Potter and the Chamber of Secrets");
    });

    test("should apply orange badge class to unrelated books", () => {
      const aiResponse = "[[The Ickabog]] is a different story.";
      const classification = {
        creamBadgeBooks: [],
        greenBadgeBooks: [],
        orangeBadgeBooks: ["The Ickabog"],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain('class="book-badge book-badge-orange"');
      expect(html).toContain("The Ickabog");
    });

    test("should apply correct classes to mixed badge colors", () => {
      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]]
                [[Harry Potter and the Chamber of Secrets]]
                [[The Ickabog]]
            `;
      const classification = {
        creamBadgeBooks: ["Harry Potter and the Philosopher's Stone"],
        greenBadgeBooks: ["Harry Potter and the Chamber of Secrets"],
        orangeBadgeBooks: ["The Ickabog"],
      };

      const html = applyColoredBadges(aiResponse, classification);

      expect(html).toContain('class="book-badge book-badge-cream"');
      expect(html).toContain('class="book-badge book-badge-green"');
      expect(html).toContain('class="book-badge book-badge-orange"');
    });

    test("should handle multiple instances of same book with same color", () => {
      const aiResponse = `
                [[1984]] was written in 1949.
                [[1984]] is about totalitarianism.
            `;
      const classification = {
        creamBadgeBooks: ["1984"],
        greenBadgeBooks: [],
        orangeBadgeBooks: [],
      };

      const html = applyColoredBadges(aiResponse, classification);

      const creamBadgeCount = (html.match(/book-badge-cream/g) || []).length;
      expect(creamBadgeCount).toBe(2); // Both instances should have cream badge
    });
  });

  // ============================================================================
  // BOOK EXTRACTION WITH RELATIONSHIPS
  // ============================================================================
  describe("Extract Books with Relationship Context", () => {
    test("should extract books and determine relationships", () => {
      const aiResponse = `
                [[Harry Potter and the Philosopher's Stone]]
                [[Harry Potter and the Chamber of Secrets]]
                [[The Ickabog]]
            `;
      const searchedBook = "Harry Potter and the Philosopher's Stone";

      const extracted = extractBooksWithRelationships(aiResponse, searchedBook);

      expect(extracted).toContainEqual({
        title: "Harry Potter and the Philosopher's Stone",
        badgeColor: "cream",
        isSearchedBook: true,
        inSameSeries: true,
      });
      expect(extracted).toContainEqual({
        title: "Harry Potter and the Chamber of Secrets",
        badgeColor: "green",
        isSearchedBook: false,
        inSameSeries: true,
      });
      expect(extracted).toContainEqual({
        title: "The Ickabog",
        badgeColor: "orange",
        isSearchedBook: false,
        inSameSeries: false,
      });
    });
  });

  // ============================================================================
  // EMPTY AND NULL CASES
  // ============================================================================
  describe("Empty and Null Input Handling", () => {
    test("should handle empty AI response", () => {
      const result = classifyBookBadges(
        "",
        "harry potter",
        null,
        "Harry Potter",
      );

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should handle null AI response", () => {
      const result = classifyBookBadges(
        null,
        "harry potter",
        null,
        "Harry Potter",
      );

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should handle response with no marked books", () => {
      const aiResponse = "This is just plain text with no book titles marked.";
      const result = classifyBookBadges(
        aiResponse,
        "harry potter",
        null,
        "Harry Potter",
      );

      expect(result.creamBadgeBooks).toEqual([]);
      expect(result.greenBadgeBooks).toEqual([]);
      expect(result.orangeBadgeBooks).toEqual([]);
    });

    test("should handle undefined searched book", () => {
      const aiResponse = "[[Harry Potter and the Philosopher's Stone]]";
      const result = classifyBookBadges(
        aiResponse,
        "harry potter",
        undefined,
        "Harry Potter",
      );

      // Should still classify as green (series book) even without specific searched book
      expect(result.greenBadgeBooks).toContain(
        "Harry Potter and the Philosopher's Stone",
      );
    });
  });

  // ============================================================================
  // PERFORMANCE AND LARGE RESPONSES
  // ============================================================================
  describe("Performance with Large Responses", () => {
    test("should handle response with 20+ books efficiently", () => {
      const books = [];
      for (let i = 1; i <= 20; i++) {
        books.push(`[[Book Title ${i}]]`);
      }
      const aiResponse = books.join(" ");

      const startTime = Date.now();
      const result = classifyBookBadges(aiResponse, "1984", "1984", null);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
      expect(result.orangeBadgeBooks).toHaveLength(20);
    });

    test("should handle very long book titles", () => {
      const aiResponse = `
                [[The Memoirs of Sherlock Holmes: Being the Adventures of the World's Most Famous Detective as Related by His Friend and Companion Dr. John H. Watson]]
            `;

      const result = classifyBookBadges(aiResponse, "sherlock", null, null);

      expect(result.orangeBadgeBooks.length).toBeGreaterThan(0);
    });
  });
});
