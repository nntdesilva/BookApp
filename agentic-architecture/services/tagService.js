/**
 * Tag Service - Handles conversion of XML tags to HTML for rendering
 */

/**
 * Convert XML book tags to HTML with appropriate styling classes
 * @param {string} text - Text containing XML tags
 * @returns {string} - Text with HTML tags and formatting
 */
function convertTagsToHTML(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Convert XML tags to HTML with appropriate styling classes
  let html = text
    .replace(
      /<original-book>(.*?)<\/original-book>/g,
      '<span class="book-tag original-book">$1</span>',
    )
    .replace(
      /<book-in-series>(.*?)<\/book-in-series>/g,
      '<span class="book-tag book-in-series">$1</span>',
    )
    .replace(
      /<unrelated-book>(.*?)<\/unrelated-book>/g,
      '<span class="book-tag unrelated-book">$1</span>',
    );

  // Convert markdown-style formatting if present
  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap in paragraph if not already wrapped
  if (!html.startsWith("<p>")) {
    html = "<p>" + html + "</p>";
  }

  return html;
}

/**
 * Extract book titles from tagged text
 * @param {string} text - Text containing XML tags
 * @returns {Array<Object>} - Array of book objects with title and type
 */
function extractBookTitles(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const books = [];

  // Extract original books
  const originalBooks = text.match(/<original-book>(.*?)<\/original-book>/g);
  if (originalBooks) {
    originalBooks.forEach((match) => {
      const title = match.replace(/<\/?original-book>/g, "");
      if (!books.find((b) => b.title === title)) {
        books.push({ title, type: "original" });
      }
    });
  }

  // Extract books in series
  const seriesBooks = text.match(/<book-in-series>(.*?)<\/book-in-series>/g);
  if (seriesBooks) {
    seriesBooks.forEach((match) => {
      const title = match.replace(/<\/?book-in-series>/g, "");
      if (!books.find((b) => b.title === title)) {
        books.push({ title, type: "series" });
      }
    });
  }

  // Extract unrelated books
  const unrelatedBooks = text.match(/<unrelated-book>(.*?)<\/unrelated-book>/g);
  if (unrelatedBooks) {
    unrelatedBooks.forEach((match) => {
      const title = match.replace(/<\/?unrelated-book>/g, "");
      if (!books.find((b) => b.title === title)) {
        books.push({ title, type: "unrelated" });
      }
    });
  }

  return books;
}

/**
 * Validate that tags are properly formatted
 * @param {string} text - Text to validate
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
function validateTags(text) {
  if (!text || typeof text !== "string") {
    return { valid: true, errors: [] };
  }

  const errors = [];

  // Check for unclosed tags
  const openTags = (
    text.match(/<(original-book|book-in-series|unrelated-book)>/g) || []
  ).length;
  const closeTags = (
    text.match(/<\/(original-book|book-in-series|unrelated-book)>/g) || []
  ).length;

  if (openTags !== closeTags) {
    errors.push("Mismatched opening and closing tags");
  }

  // Check for nested tags (not allowed)
  const nestedPattern =
    /<(original-book|book-in-series|unrelated-book)>.*?<(original-book|book-in-series|unrelated-book)>/;
  if (nestedPattern.test(text)) {
    errors.push("Nested tags detected (not allowed)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  convertTagsToHTML,
  extractBookTitles,
  validateTags,
};
