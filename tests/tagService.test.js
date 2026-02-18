const { convertTagsToHTML } = require("../services/tagService");

describe("convertTagsToHTML", () => {
  describe("happy path", () => {
    test("converts <original-book> tags", () => {
      const input = "Read <original-book>Pride and Prejudice</original-book> today.";
      const result = convertTagsToHTML(input);
      expect(result).toContain(
        '<span class="book-tag original-book">Pride and Prejudice</span>',
      );
    });

    test("converts <book-in-series> tags", () => {
      const input = "<book-in-series>The Two Towers</book-in-series>";
      const result = convertTagsToHTML(input);
      expect(result).toContain(
        '<span class="book-tag book-in-series">The Two Towers</span>',
      );
    });

    test("converts <unrelated-book> tags", () => {
      const input = "<unrelated-book>Dune</unrelated-book>";
      const result = convertTagsToHTML(input);
      expect(result).toContain(
        '<span class="book-tag unrelated-book">Dune</span>',
      );
    });

    test("converts all three tag types in one string", () => {
      const input =
        "<original-book>A</original-book> <book-in-series>B</book-in-series> <unrelated-book>C</unrelated-book>";
      const result = convertTagsToHTML(input);
      expect(result).toContain('class="book-tag original-book"');
      expect(result).toContain('class="book-tag book-in-series"');
      expect(result).toContain('class="book-tag unrelated-book"');
    });

    test("converts bold markdown to <strong>", () => {
      expect(convertTagsToHTML("**bold text**")).toContain(
        "<strong>bold text</strong>",
      );
    });

    test("converts italic markdown to <em>", () => {
      expect(convertTagsToHTML("*italic*")).toContain("<em>italic</em>");
    });

    test("converts double newlines to paragraph breaks", () => {
      const result = convertTagsToHTML("Para 1\n\nPara 2");
      expect(result).toContain("</p><p>");
    });

    test("converts single newlines to <br>", () => {
      const result = convertTagsToHTML("Line 1\nLine 2");
      expect(result).toContain("<br>");
    });

    test("wraps result in <p> tags", () => {
      const result = convertTagsToHTML("hello");
      expect(result).toBe("<p>hello</p>");
    });
  });

  describe("edge cases", () => {
    test("returns empty string for null input", () => {
      expect(convertTagsToHTML(null)).toBe("");
    });

    test("returns empty string for undefined input", () => {
      expect(convertTagsToHTML(undefined)).toBe("");
    });

    test("returns empty string for non-string input", () => {
      expect(convertTagsToHTML(42)).toBe("");
      expect(convertTagsToHTML({})).toBe("");
    });

    test("returns wrapped empty string for empty input", () => {
      expect(convertTagsToHTML("")).toBe("");
    });

    test("handles text with no tags or markdown", () => {
      expect(convertTagsToHTML("plain text")).toBe("<p>plain text</p>");
    });

    test("handles multiple instances of the same tag", () => {
      const input =
        "<original-book>A</original-book> and <original-book>A</original-book>";
      const result = convertTagsToHTML(input);
      const matches = result.match(/class="book-tag original-book"/g);
      expect(matches).toHaveLength(2);
    });
  });
});
