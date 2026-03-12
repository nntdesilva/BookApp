/**
 * Gutenberg Service - Handles Project Gutenberg API interactions
 * Uses Gutendex API (https://gutendex.com/) for searching and fetching books
 */

const config = require("../config/appConfig");
const embeddingService = require("./embeddingService");
const logger = require("../config/logger").child({ component: "gutenbergService" });

const bookTextCache = new Map();

/**
 * Search for a book in Project Gutenberg by title
 * @param {string} bookTitle - The title of the book to search for
 * @returns {Promise<Object>} - { found: boolean, book?: Object, error?: string }
 */
async function searchBook(bookTitle) {
  const t0 = Date.now();
  const url = `${config.gutenberg.apiBaseUrl}/books?search=${encodeURIComponent(bookTitle)}`;
  logger.info({ event: "gutenberg_search", bookTitle, url });
  try {
    const response = await fetch(url);

    if (!response.ok) {
      logger.error({ event: "gutenberg_api_error", httpStatus: response.status, bookTitle });
      throw new Error(`Gutenberg API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      logger.info({ event: "gutenberg_search_no_results", bookTitle, durationMs: Date.now() - t0 });
      return {
        found: false,
        error: "Book not found in Project Gutenberg",
      };
    }

    logger.info({ event: "gutenberg_search_results", bookTitle, resultCount: data.results.length, durationMs: Date.now() - t0 });

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
      logger.warn({ event: "gutenberg_no_text_format", gutenbergId: bestMatch.id, title: bestMatch.title });
      return {
        found: false,
        error: "Book found but no text format available",
      };
    }

    logger.info({ event: "gutenberg_best_match", gutenbergId: bestMatch.id, title: bestMatch.title, textUrl });
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
    logger.error({ event: "gutenberg_search_error", bookTitle, durationMs: Date.now() - t0, err: error });
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
  if (bookTextCache.has(textUrl)) {
    const cached = bookTextCache.get(textUrl);
    logger.info({ event: "book_text_cache_hit", textUrl, textLength: cached.text ? cached.text.length : 0 });
    return cached;
  }

  const t0 = Date.now();
  logger.info({ event: "book_text_fetch", textUrl });
  try {
    const response = await fetch(textUrl);

    if (!response.ok) {
      logger.error({ event: "book_text_fetch_failed", httpStatus: response.status, textUrl });
      throw new Error(`Failed to fetch book text: ${response.status}`);
    }

    const text = await response.text();
    logger.info({ event: "book_text_fetched_cached", textUrl, textLength: text.length, durationMs: Date.now() - t0 });

    const result = { success: true, text };
    bookTextCache.set(textUrl, result);
    return result;
  } catch (error) {
    logger.error({ event: "book_text_fetch_error", textUrl, durationMs: Date.now() - t0, err: error });
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

/**
 * Extract all unique words from a text
 * Lowercases, strips punctuation, splits by whitespace, and deduplicates
 * Filters out very short words (1 char) and pure numbers
 * @param {string} text - The full text to extract words from
 * @returns {string[]} - Array of unique lowercase words
 */
function extractUniqueWords(text) {
  // Lowercase and replace non-letter characters with spaces
  const cleaned = text.toLowerCase().replace(/[^a-z'-]/g, " ");

  // Split by whitespace and filter
  const words = cleaned.split(/\s+/).filter((word) => {
    // Remove leading/trailing punctuation from each word
    const trimmed = word.replace(/^['-]+|['-]+$/g, "");
    // Keep words that are at least 2 characters and not empty
    return trimmed.length >= 2;
  });

  // Clean each word (strip leading/trailing punctuation) and deduplicate
  const uniqueSet = new Set();
  for (const word of words) {
    const trimmed = word.replace(/^['-]+|['-]+$/g, "");
    if (trimmed.length >= 2) {
      uniqueSet.add(trimmed);
    }
  }

  return Array.from(uniqueSet);
}

/**
 * Get the full text of a book from Gutenberg by title
 * Combines book resolution and text fetching into one call
 * @param {string} bookTitle - The title of the book
 * @returns {Promise<Object>} - { success, text?, bookTitle?, authors?, error? }
 */
async function getBookFullText(bookTitle) {
  // Resolve the book first
  const resolution = await resolveBookForSearch(bookTitle);

  if (!resolution.available) {
    return {
      success: false,
      error: resolution.reason,
      searchedTitle: bookTitle,
    };
  }

  // Fetch the full text
  const textResult = await fetchBookText(resolution.textUrl);

  if (!textResult.success) {
    return {
      success: false,
      error: textResult.error,
      bookTitle: resolution.title,
    };
  }

  return {
    success: true,
    text: textResult.text,
    bookTitle: stripSubtitle(resolution.title),
    authors: resolution.authors,
  };
}

/**
 * Count all words semantically related to a concept in a Gutenberg book.
 * Orchestrates: fetch text → extract unique words → find related via embeddings → count each.
 * @param {string} bookTitle - The title of the book
 * @param {string} concept - The concept/category to find related words for
 * @returns {Promise<Object>} - { success, bookTitle?, authors?, concept?, relatedWords?, totalOccurrences?, uniqueWordsAnalyzed?, error? }
 */
async function countRelatedWordsInBook(bookTitle, concept) {
  const bookResult = await getBookFullText(bookTitle);

  if (!bookResult.success) {
    return {
      success: false,
      error: bookResult.error,
      searchedTitle: bookTitle,
    };
  }

  const uniqueWords = extractUniqueWords(bookResult.text);
  logger.info({ event: "semantic_search_start", bookTitle, concept, uniqueWordCount: uniqueWords.length });
  const relatedWords = await embeddingService.findRelatedWords(
    concept,
    uniqueWords,
  );
  logger.info({ event: "semantic_search_complete", concept, relatedWordsFound: relatedWords.length });

  const wordCounts = relatedWords.map((entry) => {
    const countResult = countWordOccurrences(bookResult.text, entry.word);
    return {
      word: entry.word,
      count: countResult.count,
      similarity: entry.similarity,
    };
  });

  const filteredCounts = wordCounts
    .filter((w) => w.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalOccurrences = filteredCounts.reduce(
    (sum, w) => sum + w.count,
    0,
  );

  return {
    success: true,
    bookTitle: bookResult.bookTitle,
    authors: bookResult.authors,
    concept,
    relatedWords: filteredCounts,
    totalOccurrences,
    uniqueWordsAnalyzed: uniqueWords.length,
  };
}

module.exports = {
  searchBook,
  fetchBookText,
  countWordOccurrences,
  resolveBookForSearch,
  countWordInBook,
  extractUniqueWords,
  getBookFullText,
  countRelatedWordsInBook,
};
