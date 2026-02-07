/**
 * Gutenberg Service - Handles Project Gutenberg API interactions
 * Uses Gutendex API (https://gutendex.com/) for searching and fetching books
 */

const config = require("../config/appConfig");

/**
 * Search for a book in Project Gutenberg by title
 * @param {string} bookTitle - The title of the book to search for
 * @returns {Promise<Object>} - { found: boolean, book?: Object, error?: string }
 */
async function searchBook(bookTitle) {
  try {
    const searchQuery = encodeURIComponent(bookTitle);
    const response = await fetch(
      `${config.gutenberg.apiBaseUrl}/books?search=${searchQuery}`,
    );

    if (!response.ok) {
      throw new Error(`Gutenberg API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return {
        found: false,
        error: "Book not found in Project Gutenberg",
      };
    }

    // Find the best match - prefer exact title matches
    const normalizedSearch = bookTitle.toLowerCase().trim();
    let bestMatch = data.results[0];

    for (const book of data.results) {
      const bookTitleLower = book.title.toLowerCase();
      if (bookTitleLower === normalizedSearch) {
        bestMatch = book;
        break;
      }
      // Check if the search term is contained in the title
      if (
        bookTitleLower.includes(normalizedSearch) ||
        normalizedSearch.includes(bookTitleLower.split(";")[0].trim())
      ) {
        bestMatch = book;
        break;
      }
    }

    // Extract text URL from formats (prefer plain text)
    const textUrl = getTextUrl(bestMatch.formats);

    if (!textUrl) {
      return {
        found: false,
        error: "Book found but no text format available",
      };
    }

    return {
      found: true,
      book: {
        gutenbergId: bestMatch.id,
        title: bestMatch.title,
        authors: bestMatch.authors.map((a) => a.name),
        textUrl: textUrl,
        languages: bestMatch.languages,
      },
    };
  } catch (error) {
    console.error("Error searching Gutenberg:", error);
    return {
      found: false,
      error: error.message || "Failed to search Project Gutenberg",
    };
  }
}

/**
 * Strip subtitle from book title (removes everything after semicolon)
 * @param {string} title - Full book title with potential subtitle
 * @returns {string} - Title without subtitle
 */
function stripSubtitle(title) {
  if (!title) return title;

  // Remove everything after semicolon and trim whitespace
  const mainTitle = title.split(";")[0].trim();
  return mainTitle;
}

/**
 * Extract the best text URL from Gutenberg formats
 * @param {Object} formats - The formats object from Gutenberg API
 * @returns {string|null} - URL to the text file or null
 */
function getTextUrl(formats) {
  // Priority order for text formats
  const preferredFormats = [
    "text/plain; charset=utf-8",
    "text/plain; charset=us-ascii",
    "text/plain",
  ];

  for (const format of preferredFormats) {
    if (formats[format]) {
      return formats[format];
    }
  }

  // Fallback: find any text/plain format
  for (const [key, url] of Object.entries(formats)) {
    if (key.startsWith("text/plain")) {
      return url;
    }
  }

  return null;
}

/**
 * Fetch the full text of a book from Gutenberg
 * @param {string} textUrl - URL to the book's text file
 * @returns {Promise<Object>} - { success: boolean, text?: string, error?: string }
 */
async function fetchBookText(textUrl) {
  try {
    const response = await fetch(textUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch book text: ${response.status}`);
    }

    const text = await response.text();

    return {
      success: true,
      text: text,
    };
  } catch (error) {
    console.error("Error fetching book text:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch book text",
    };
  }
}

/**
 * Count occurrences of a word/phrase in text (case-insensitive, handles variations)
 * @param {string} text - The full text to search in
 * @param {string} searchTerm - The word or phrase to search for
 * @returns {Object} - { count: number, term: string }
 */
function countWordOccurrences(text, searchTerm) {
  // Normalize the search term and text for case-insensitive matching
  const normalizedText = text.toLowerCase();
  const normalizedTerm = searchTerm.toLowerCase().trim();

  // Create a regex that matches the term with word boundaries where possible
  // This handles multi-word phrases and allows for punctuation variations
  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Use word boundary for single words, looser matching for phrases
  const pattern = normalizedTerm.includes(" ")
    ? new RegExp(escapedTerm, "gi")
    : new RegExp(`\\b${escapedTerm}\\b`, "gi");

  const matches = normalizedText.match(pattern);
  const count = matches ? matches.length : 0;

  return {
    count: count,
    term: searchTerm,
  };
}

/**
 * Resolve a book for word search - checks if available in Gutenberg
 * @param {string} bookTitle - The title of the book
 * @returns {Promise<Object>} - Resolution result with availability info
 */
async function resolveBookForSearch(bookTitle) {
  const searchResult = await searchBook(bookTitle);
  console.log("searchResult", searchResult);

  if (!searchResult.found) {
    return {
      available: false,
      reason: searchResult.error || "Book not found in Project Gutenberg",
      searchedTitle: bookTitle,
    };
  }

  return {
    available: true,
    gutenbergId: searchResult.book.gutenbergId,
    title: searchResult.book.title,
    authors: searchResult.book.authors,
    textUrl: searchResult.book.textUrl,
    searchedTitle: bookTitle,
  };
}

/**
 * Count occurrences of a word/phrase in a Gutenberg book
 * @param {string} bookTitle - The title of the book to search in
 * @param {string} searchTerm - The word or phrase to count
 * @returns {Promise<Object>} - { success: boolean, count?: number, bookTitle?: string, error?: string }
 */
async function countWordInBook(bookTitle, searchTerm) {
  // First, resolve the book
  const resolution = await resolveBookForSearch(bookTitle);

  if (!resolution.available) {
    return {
      success: false,
      error: resolution.reason,
      searchedTitle: bookTitle,
    };
  }

  // Fetch the book text
  const textResult = await fetchBookText(resolution.textUrl);

  if (!textResult.success) {
    return {
      success: false,
      error: textResult.error,
      bookTitle: resolution.title,
    };
  }

  // Count occurrences
  const countResult = countWordOccurrences(textResult.text, searchTerm);

  return {
    success: true,
    count: countResult.count,
    searchTerm: countResult.term,
    bookTitle: stripSubtitle(resolution.title),
    authors: resolution.authors,
  };
}

module.exports = {
  searchBook,
  fetchBookText,
  countWordOccurrences,
  resolveBookForSearch,
  countWordInBook,
};
