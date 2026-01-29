/**
 * Colored Badge Detection System
 *
 * This module provides functionality to classify book titles based on their
 * relationship to the searched book/series and apply colored badges.
 *
 * BADGE COLORS:
 * - CREAM: The exact book the user searched for
 * - GREEN: Books in the same series as the searched book
 * - ORANGE: Books unrelated to the series (different series or standalone)
 */

/**
 * Known book series data
 * This would ideally come from a database or API in production
 */
const BOOK_SERIES = {
  "Harry Potter": [
    "Harry Potter and the Philosopher's Stone",
    "Harry Potter and the Chamber of Secrets",
    "Harry Potter and the Prisoner of Azkaban",
    "Harry Potter and the Goblet of Fire",
    "Harry Potter and the Order of the Phoenix",
    "Harry Potter and the Half-Blood Prince",
    "Harry Potter and the Deathly Hallows",
  ],
  "The Lord of the Rings": [
    "The Fellowship of the Ring",
    "The Two Towers",
    "The Return of the King",
  ],
  "The Hunger Games": ["The Hunger Games", "Catching Fire", "Mockingjay"],
  "The Chronicles of Narnia": [
    "The Lion, the Witch and the Wardrobe",
    "Prince Caspian",
    "The Voyage of the Dawn Treader",
    "The Silver Chair",
    "The Horse and His Boy",
    "The Magician's Nephew",
    "The Last Battle",
  ],
};

/**
 * Get series information for a given book title
 * @param {string} bookTitle - The book title to look up
 * @returns {Object} Series information including series name and all books in series
 */
function getSeriesInfo(bookTitle) {
  if (!bookTitle) {
    return {
      isPartOfSeries: false,
      seriesName: null,
      allBooksInSeries: [],
    };
  }

  const normalizedTitle = bookTitle.toLowerCase().trim();

  // Check each series to see if the book title is in it
  for (const [seriesName, books] of Object.entries(BOOK_SERIES)) {
    // Check if the exact book title matches any book in the series
    const matchingBook = books.find(
      (book) => book.toLowerCase() === normalizedTitle,
    );

    if (matchingBook) {
      return {
        isPartOfSeries: true,
        seriesName: seriesName,
        allBooksInSeries: books,
      };
    }
  }

  // Not found in any series
  return {
    isPartOfSeries: false,
    seriesName: null,
    allBooksInSeries: [],
  };
}

/**
 * Check if a query is a series name (not a specific book title)
 * @param {string} query - The search query
 * @returns {Object} { isSeries: boolean, seriesName: string|null }
 */
function isSeriesQuery(query) {
  if (!query) {
    return { isSeries: false, seriesName: null };
  }

  const normalizedQuery = query.toLowerCase().trim();

  // Check if the query matches a series name
  for (const [seriesName, books] of Object.entries(BOOK_SERIES)) {
    if (seriesName.toLowerCase() === normalizedQuery) {
      return { isSeries: true, seriesName: seriesName };
    }
  }

  // Check for common series name variations
  const seriesVariations = {
    "harry potter": "Harry Potter",
    hp: "Harry Potter",
    lotr: "The Lord of the Rings",
    "lord of the rings": "The Lord of the Rings",
    "the lord of the rings": "The Lord of the Rings",
    "hunger games": "The Hunger Games",
    "the hunger games": "The Hunger Games",
    narnia: "The Chronicles of Narnia",
    "chronicles of narnia": "The Chronicles of Narnia",
    "the chronicles of narnia": "The Chronicles of Narnia",
  };

  if (seriesVariations[normalizedQuery]) {
    return { isSeries: true, seriesName: seriesVariations[normalizedQuery] };
  }

  return { isSeries: false, seriesName: null };
}

/**
 * Check if a title is a known series name (not an individual book title)
 * @param {string} title - The title to check
 * @returns {boolean} True if this is a series name, false otherwise
 */
function isKnownSeriesName(title) {
  if (!title) return false;

  const normalizedTitle = title.toLowerCase().trim();

  // List of known series names that should NOT be badged
  const knownSeriesNames = [
    "harry potter",
    "the lord of the rings",
    "lord of the rings",
    "the hunger games",
    "hunger games",
    "the chronicles of narnia",
    "chronicles of narnia",
    "cormoran strike",
    "strike",
    "a song of ice and fire",
    "game of thrones",
    "the wheel of time",
    "wheel of time",
    "narnia",
    "lotr",
    "hp",
  ];

  // Check against known series names
  if (knownSeriesNames.includes(normalizedTitle)) {
    return true;
  }

  // Check if it matches any series name from BOOK_SERIES
  for (const seriesName of Object.keys(BOOK_SERIES)) {
    if (seriesName.toLowerCase() === normalizedTitle) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a title is an actual book title (not a series name)
 * @param {string} title - The title to check
 * @returns {boolean} True if this is a book title, false if it's a series name
 */
function isActualBookTitle(title) {
  if (!title) return false;

  const normalizedTitle = title.toLowerCase().trim();

  // SPECIAL CASE: Check if it's BOTH a series name AND a book title
  // (e.g., "The Hunger Games" is both the series name and the first book's title)
  let isBookInDatabase = false;
  for (const books of Object.values(BOOK_SERIES)) {
    if (books.some((book) => book.toLowerCase() === normalizedTitle)) {
      isBookInDatabase = true;
      break;
    }
  }

  // If it's in the book database, treat it as a book title (even if it's also a series name)
  if (isBookInDatabase) {
    return true;
  }

  // If it's a known series name and NOT in the book database, it's just a series reference
  if (isKnownSeriesName(title)) {
    return false;
  }

  // If not in our database, assume it's a book title (for unknown books)
  return true;
}

/**
 * Normalize book title (handle common variations, misspellings)
 * @param {string} title - The title to normalize
 * @returns {string} Normalized title
 */
function normalizeBookTitle(title) {
  if (!title) return title;

  let normalized = title.trim();

  // Normalize common patterns
  const normalizations = {
    "48 laws of power": "The 48 Laws of Power",
    "the 48 laws of power": "The 48 Laws of Power",
    "harry potter philosopher stone":
      "Harry Potter and the Philosopher's Stone",
    "harry potter and the philosopher stone":
      "Harry Potter and the Philosopher's Stone",
    "the great gatsby": "The Great Gatsby",
    "great gatsby": "The Great Gatsby",
    "lord of the rings": "The Fellowship of the Ring",
    "the lord of the rings": "The Fellowship of the Ring",
    "harry potter": "Harry Potter and the Philosopher's Stone",
  };

  const lowerTitle = normalized.toLowerCase();
  if (normalizations[lowerTitle]) {
    return normalizations[lowerTitle];
  }

  // Capitalize first letter of each word
  normalized = normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return normalized;
}

/**
 * Extract quoted or italicized book titles as fallback
 * This handles cases where AI forgets to use [[brackets]]
 * @param {string} text - The AI response text
 * @returns {Array<string>} Array of extracted book titles from quotes/italics
 */
function extractQuotedTitles(text) {
  if (!text) return [];

  const titles = [];
  const patterns = [
    /"([^"]+)"/g, // Double quotes
    /'([^']+)'/g, // Single quotes
    /\*([^*]+)\*/g, // Italics (markdown)
    /"([^"]+)"/g, // Curly quotes
    /'([^']+)'/g, // Curly single quotes
  ];

  // Known J.K. Rowling standalone books that often get missed
  const knownJKRBooks = [
    "The Ickabog",
    "The Casual Vacancy",
    "The Christmas Pig",
    "Fantastic Beasts and Where to Find Them",
    "Quidditch Through the Ages",
    "The Tales of Beedle the Bard",
  ];

  // Known standalone books by other authors
  const knownStandaloneBooks = [
    "1984",
    "Animal Farm",
    "The Great Gatsby",
    "To Kill a Mockingbird",
    "Anna Karenina",
    "War and Peace",
    "The Catcher in the Rye",
    "Pride and Prejudice",
    "The Hobbit",
  ];

  const allKnownBooks = [...knownJKRBooks, ...knownStandaloneBooks];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const potentialTitle = match[1].trim();

      // Only treat it as a book title if:
      // 1. It's in our known books list, OR
      // 2. It matches a book title pattern (starts with "The " and has capitals)
      const isKnownBook = allKnownBooks.some(
        (book) => book.toLowerCase() === potentialTitle.toLowerCase(),
      );

      const looksLikeBookTitle =
        /^(The |A |An )?[A-Z][a-zA-Z\s',]+$/.test(potentialTitle) &&
        potentialTitle.split(" ").length >= 2 &&
        potentialTitle.split(" ").length <= 10;

      if (isKnownBook || looksLikeBookTitle) {
        // Normalize to proper case if it's a known book
        const normalizedTitle =
          allKnownBooks.find(
            (book) => book.toLowerCase() === potentialTitle.toLowerCase(),
          ) || potentialTitle;

        titles.push(normalizedTitle);
      }
    }
  }

  return titles;
}

/**
 * Extract all book titles from AI response text
 * @param {string} text - The AI response text with [[marked books]]
 * @returns {Array<string>} Array of extracted book titles
 */
function extractMarkedTitles(text) {
  if (!text) return [];

  const titles = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const title = match[1];
    const matchIndex = match.index;

    // Extract the sentence/context around this match
    // Look BACKWARD to previous period or start, and FORWARD to next period or end
    const prevPeriod = text.lastIndexOf(".", matchIndex);
    const contextStart = prevPeriod !== -1 ? prevPeriod + 1 : 0;

    const nextPeriod = text.indexOf(".", matchIndex);
    const contextEnd = nextPeriod !== -1 ? nextPeriod : text.length;

    const context = text.substring(contextStart, contextEnd).toLowerCase();

    // Check if this is explicitly described as a book or book-related action
    const bookIndicators =
      /\b(first book|second book|third book|book in|is a \w+\s*book|is a book|novel|concludes|starts|begins|ends|book of|part of|continues|followed by|includes|best known for|most famous|rest of|first in|second in|third in|in the|prequel|different work|fairy tale book|fantasy book|children's book|books? including|written many books?|other books?)\b/i;
    const hasBookIndicator = bookIndicators.test(context);

    // Check if the wrapped title is followed by "series" pattern (e.g., "The X series")
    // This indicates the title itself is being called a series
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const directSeriesReference = new RegExp(
      `\\[\\[${escapedTitle}\\]\\]\\s+(series|trilogy|saga)`,
      "i",
    );
    const isDirectSeriesRef = directSeriesReference.test(context);

    // Check if it's a pattern like "[[Book]] - ... series" (describing which series the book belongs to)
    const bookWithSeriesDescription = new RegExp(
      `\\[\\[${escapedTitle}\\]\\]\\s*-[^\\n]*\\b(series|trilogy)`,
      "i",
    );
    const isBookWithSeriesDesc = bookWithSeriesDescription.test(context);

    // Check if series-indicating words appear in the context
    const seriesIndicators = /\b(series|trilogy|saga|collection)\b/i;
    const hasSeriesIndicator = seriesIndicators.test(context);

    // If it's directly called a series (e.g., "[[Harry Potter]] series"), skip it
    if (isDirectSeriesRef && !isBookWithSeriesDesc) {
      continue;
    }

    // If it matches the "[[Book]] - ... series" pattern, it's a book
    if (isBookWithSeriesDesc) {
      titles.push(title);
      continue;
    }

    // If it has book indicators, treat as book even if "series" also appears
    if (hasBookIndicator) {
      titles.push(title);
      continue;
    }

    // If it has series indicators but no book indicators, skip it
    if (hasSeriesIndicator) {
      continue;
    }

    // No clear indicators - include it
    titles.push(title);
  }

  // FALLBACK: Also extract quoted/italicized titles (for when AI forgets [[brackets]])
  const quotedTitles = extractQuotedTitles(text);

  // Merge quoted titles, avoiding duplicates
  for (const quotedTitle of quotedTitles) {
    const quotedLower = quotedTitle.toLowerCase().trim();
    const alreadyIncluded = titles.some(
      (existingTitle) => existingTitle.toLowerCase().trim() === quotedLower,
    );

    if (!alreadyIncluded && isActualBookTitle(quotedTitle)) {
      titles.push(quotedTitle);
    }
  }

  return titles;
}

/**
 * Classify books into badge color categories
 * @param {string} aiResponse - The AI response text with [[marked books]]
 * @param {string} searchedQuery - The original search query from user
 * @param {string|null} searchedBook - The specific book that was searched (null if series search)
 * @param {string|null} seriesName - The series name if searching within a series
 * @returns {Object} Classification with creamBadgeBooks, greenBadgeBooks, orangeBadgeBooks arrays
 */
function classifyBookBadges(
  aiResponse,
  searchedQuery,
  searchedBook,
  seriesName,
) {
  // Handle null/empty responses
  if (!aiResponse) {
    return {
      creamBadgeBooks: [],
      greenBadgeBooks: [],
      orangeBadgeBooks: [],
    };
  }

  // Extract all marked book titles from the response
  const markedBooks = extractMarkedTitles(aiResponse);

  // Remove duplicates
  const uniqueBooks = [...new Set(markedBooks)];

  // CRITICAL: Filter out series names - they should NEVER be badged
  const actualBookTitles = uniqueBooks.filter((title) =>
    isActualBookTitle(title),
  );

  const creamBadgeBooks = [];
  const greenBadgeBooks = [];
  const orangeBadgeBooks = [];

  // Get the series books if a series name is provided
  let seriesBooks = [];
  if (seriesName && BOOK_SERIES[seriesName]) {
    seriesBooks = BOOK_SERIES[seriesName];
  } else if (searchedBook) {
    // If no series name but we have a searched book, try to find its series
    const seriesInfo = getSeriesInfo(searchedBook);
    if (seriesInfo.isPartOfSeries) {
      seriesBooks = seriesInfo.allBooksInSeries;
    }
  }

  // Classify each book (only actual book titles, not series names)
  for (const book of actualBookTitles) {
    const bookLower = book.toLowerCase().trim();
    const searchedBookLower = searchedBook
      ? searchedBook.toLowerCase().trim()
      : null;

    // CREAM: Exact match to searched book
    if (searchedBook && bookLower === searchedBookLower) {
      creamBadgeBooks.push(book);
    }
    // GREEN: In the same series (but not the exact searched book)
    else if (seriesBooks.length > 0) {
      const isInSeries = seriesBooks.some(
        (seriesBook) => seriesBook.toLowerCase() === bookLower,
      );
      if (isInSeries) {
        greenBadgeBooks.push(book);
      } else {
        orangeBadgeBooks.push(book);
      }
    }
    // ORANGE: Everything else (when no series or not in series)
    else {
      orangeBadgeBooks.push(book);
    }
  }

  return {
    creamBadgeBooks,
    greenBadgeBooks,
    orangeBadgeBooks,
  };
}

/**
 * Apply colored badge HTML to the AI response
 * @param {string} aiResponse - The AI response text with [[marked books]]
 * @param {Object} classification - The badge classification object
 * @returns {string} HTML with colored badge spans
 */
function applyColoredBadges(aiResponse, classification) {
  if (!aiResponse) return aiResponse;

  let result = aiResponse;

  // Helper function to determine badge color for a book
  const getBadgeColor = (bookTitle) => {
    const bookLower = bookTitle.toLowerCase().trim();

    // Check cream badges
    if (
      classification.creamBadgeBooks.some(
        (book) => book.toLowerCase().trim() === bookLower,
      )
    ) {
      return "cream";
    }

    // Check green badges
    if (
      classification.greenBadgeBooks.some(
        (book) => book.toLowerCase().trim() === bookLower,
      )
    ) {
      return "green";
    }

    // Check orange badges
    if (
      classification.orangeBadgeBooks.some(
        (book) => book.toLowerCase().trim() === bookLower,
      )
    ) {
      return "orange";
    }

    // Not found in any classification - could be a series name
    return null;
  };

  // Replace all [[Book Title]] with appropriate badge HTML or plain text
  result = result.replace(
    /\[\[([^\]]+)\]\](\s+(?:series|trilogy|saga|collection))?/gi,
    (match, bookTitle, seriesIndicator) => {
      // CRITICAL: If followed by series-indicating words, this is a series reference
      if (seriesIndicator) {
        // Don't badge series references - return without brackets
        return bookTitle + seriesIndicator;
      }

      // CRITICAL: Check if this is a series name (but not also a book title)
      if (isKnownSeriesName(bookTitle) && !isActualBookTitle(bookTitle)) {
        // Pure series names should NOT be badged - return as plain text
        return bookTitle;
      }

      const badgeColor = getBadgeColor(bookTitle);

      // If no badge color found (not in classification), return plain text
      if (!badgeColor) {
        return bookTitle;
      }

      return `<span class="book-badge book-badge-${badgeColor}">${bookTitle}</span>`;
    },
  );

  // FALLBACK: Also badge quoted/italicized book titles (for when AI forgets [[brackets]])
  // Handle double quotes: "The Ickabog"
  result = result.replace(/"([^"]+)"/g, (match, bookTitle) => {
    const badgeColor = getBadgeColor(bookTitle);
    if (badgeColor) {
      return `<span class="book-badge book-badge-${badgeColor}">${bookTitle}</span>`;
    }
    return match; // Keep original if not in classification
  });

  // Handle curly quotes: "The Ickabog"
  result = result.replace(/"([^"]+)"/g, (match, bookTitle) => {
    const badgeColor = getBadgeColor(bookTitle);
    if (badgeColor) {
      return `<span class="book-badge book-badge-${badgeColor}">${bookTitle}</span>`;
    }
    return match; // Keep original if not in classification
  });

  // Handle italics: *The Ickabog* (but keep the markdown)
  result = result.replace(/\*([^*]+)\*/g, (match, bookTitle) => {
    const badgeColor = getBadgeColor(bookTitle);
    if (badgeColor) {
      return `<span class="book-badge book-badge-${badgeColor}"><em>${bookTitle}</em></span>`;
    }
    return match; // Keep original if not in classification
  });

  return result;
}

/**
 * Extract books with their relationship context
 * @param {string} aiResponse - The AI response text
 * @param {string} searchedBook - The book that was searched
 * @returns {Array<Object>} Array of books with relationship metadata
 */
function extractBooksWithRelationships(aiResponse, searchedBook) {
  if (!aiResponse) return [];

  // Extract all marked books
  const markedBooks = extractMarkedTitles(aiResponse);

  // Get series info for the searched book
  const searchedSeriesInfo = searchedBook
    ? getSeriesInfo(searchedBook)
    : { isPartOfSeries: false, seriesName: null, allBooksInSeries: [] };

  const result = [];

  for (const book of markedBooks) {
    const bookLower = book.toLowerCase().trim();
    const searchedBookLower = searchedBook
      ? searchedBook.toLowerCase().trim()
      : null;

    // Check if this is the searched book
    const isSearchedBook = searchedBook && bookLower === searchedBookLower;

    // Check if this book is in the same series
    let inSameSeries = false;
    let badgeColor = "orange";

    if (isSearchedBook) {
      badgeColor = "cream";
      inSameSeries = searchedSeriesInfo.isPartOfSeries;
    } else if (searchedSeriesInfo.isPartOfSeries) {
      inSameSeries = searchedSeriesInfo.allBooksInSeries.some(
        (seriesBook) => seriesBook.toLowerCase() === bookLower,
      );
      if (inSameSeries) {
        badgeColor = "green";
      }
    }

    result.push({
      title: book,
      badgeColor: badgeColor,
      isSearchedBook: isSearchedBook,
      inSameSeries: inSameSeries,
    });
  }

  return result;
}

module.exports = {
  classifyBookBadges,
  getSeriesInfo,
  normalizeBookTitle,
  applyColoredBadges,
  extractBooksWithRelationships,
  extractMarkedTitles,
  extractQuotedTitles,
  isSeriesQuery,
  isKnownSeriesName,
  isActualBookTitle,
  BOOK_SERIES,
};
