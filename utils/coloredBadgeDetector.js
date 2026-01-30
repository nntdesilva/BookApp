/**
 * Colored Badge Detection System - AI-Powered
 *
 * This module provides functionality to classify book titles based on their
 * relationship to the searched book/series and apply colored badges using AI.
 *
 * BADGE COLORS:
 * - CREAM: The exact book the user searched for
 * - GREEN: Books in the same series as the searched book
 * - ORANGE: Books unrelated to the series (different series or standalone)
 */

const OpenAI = require("openai");

let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Analyze if input is a series name or book title, and get series information
 * @param {string} input - The search query (could be series name or book title)
 * @returns {Promise<Object>} Complete series information
 *   - isSeries: true if input is a series name, false if it's a book title
 *   - seriesName: name of the series (or null if standalone book)
 *   - allBooksInSeries: array of books in the series (empty if standalone)
 */
async function analyzeBookOrSeries(input) {
  if (!input) {
    return {
      isSeries: false,
      seriesName: null,
      allBooksInSeries: [],
    };
  }

  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error("OpenAI client not configured");
    }

    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a book series expert. Analyze whether input is a series name or book title, and provide series information.",
        },
        {
          role: "user",
          content: `Analyze this input: "${input}"

Determine:
1. Is this a SERIES NAME (like "Harry Potter", "Lord of the Rings") or a SPECIFIC BOOK TITLE (like "Harry Potter and the Philosopher's Stone")?
2. If it's a series name: provide the series name and all books in that series
3. If it's a book title: check if the book is part of a series, and if yes, provide the series name and all books in that series

Respond in JSON format:
{
  "isSeries": true/false,
  "seriesName": "series name" or null,
  "allBooksInSeries": ["book1", "book2", ...] or []
}

Notes:
- isSeries: true means the input is a series name itself, false means it's a book title
- seriesName: the name of the series (null only if it's a standalone book)
- allBooksInSeries: list all main series books in order (empty array only if standalone book)
- Only include main series books, not spin-offs or companion books

IMPORTANT: Return ONLY valid JSON, no other text.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content.trim();

    let parsedResponse;
    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
        null,
        response,
      ];
      parsedResponse = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error(
        "Failed to parse AI response for book/series analysis:",
        response,
      );
      return {
        isSeries: false,
        seriesName: null,
        allBooksInSeries: [],
      };
    }

    return {
      isSeries: parsedResponse.isSeries || false,
      seriesName: parsedResponse.seriesName || null,
      allBooksInSeries: parsedResponse.allBooksInSeries || [],
    };
  } catch (error) {
    console.error("Error analyzing book or series:", error);
    return {
      isSeries: false,
      seriesName: null,
      allBooksInSeries: [],
    };
  }
}

/**
 * Check if a title is an actual book title (not a series name) using AI
 * @param {string} title - The title to check
 * @returns {Promise<boolean>} True if this is a book title, false if it's a series name
 */
async function isActualBookTitle(title) {
  if (!title) return false;

  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error("OpenAI client not configured");
    }

    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a book expert. Determine if a title is a specific book or a series name.",
        },
        {
          role: "user",
          content: `Is "${title}" a specific book title or a series name?

Note: Some titles like "The Hunger Games" are BOTH - the series name AND the first book's title. In such cases, respond as "book" since it can refer to a specific book.

Respond with ONLY one word: "book" or "series"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    const response = completion.choices[0].message.content.trim().toLowerCase();
    return response.includes("book");
  } catch (error) {
    console.error("Error checking if actual book title:", error);
    // Default to true to avoid filtering out actual books
    return true;
  }
}

/**
 * Normalize book title - basic cleanup only (AI handles variations)
 * @param {string} title - The title to normalize
 * @returns {string} Normalized title
 */
function normalizeBookTitle(title) {
  if (!title) return title;
  return title.trim();
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
    /"([^"]+)"/g,
    /'([^']+)'/g,
    /\*([^*]+)\*/g,
    /"([^"]+)"/g,
    /'([^']+)'/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const potentialTitle = match[1].trim();

      const looksLikeBookTitle =
        /^(The |A |An )?[A-Z][a-zA-Z\s',]+$/.test(potentialTitle) &&
        potentialTitle.split(" ").length >= 2 &&
        potentialTitle.split(" ").length <= 10;

      if (looksLikeBookTitle) {
        titles.push(potentialTitle);
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

    const prevPeriod = text.lastIndexOf(".", matchIndex);
    const contextStart = prevPeriod !== -1 ? prevPeriod + 1 : 0;
    const nextPeriod = text.indexOf(".", matchIndex);
    const contextEnd = nextPeriod !== -1 ? nextPeriod : text.length;
    const context = text.substring(contextStart, contextEnd).toLowerCase();

    const bookIndicators =
      /\b(first book|second book|third book|book in|is a \w+\s*book|is a book|novel|concludes|starts|begins|ends|book of|part of|continues|followed by|includes|best known for|most famous|rest of|first in|second in|third in|in the|prequel|different work|fairy tale book|fantasy book|children's book|books? including|written many books?|other books?)\b/i;
    const hasBookIndicator = bookIndicators.test(context);

    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const directSeriesReference = new RegExp(
      `\\[\\[${escapedTitle}\\]\\]\\s+(series|trilogy|saga)`,
      "i",
    );
    const isDirectSeriesRef = directSeriesReference.test(context);

    const bookWithSeriesDescription = new RegExp(
      `\\[\\[${escapedTitle}\\]\\]\\s*-[^\\n]*\\b(series|trilogy)`,
      "i",
    );
    const isBookWithSeriesDesc = bookWithSeriesDescription.test(context);

    const seriesIndicators = /\b(series|trilogy|saga|collection)\b/i;
    const hasSeriesIndicator = seriesIndicators.test(context);

    if (isDirectSeriesRef && !isBookWithSeriesDesc) {
      continue;
    }

    if (isBookWithSeriesDesc) {
      titles.push(title);
      continue;
    }

    if (hasBookIndicator) {
      titles.push(title);
      continue;
    }

    if (hasSeriesIndicator) {
      continue;
    }

    titles.push(title);
  }

  const quotedTitles = extractQuotedTitles(text);

  for (const quotedTitle of quotedTitles) {
    const quotedLower = quotedTitle.toLowerCase().trim();
    const alreadyIncluded = titles.some(
      (existingTitle) => existingTitle.toLowerCase().trim() === quotedLower,
    );

    if (!alreadyIncluded) {
      titles.push(quotedTitle);
    }
  }

  return titles;
}

/**
 * Classify books into badge color categories using AI
 * @param {string} aiResponse - The AI response text with [[marked books]]
 * @param {string} searchedQuery - The corrected search query (spelling/caps fixed)
 * @param {string|null} searchedBook - The specific book that was searched (null if series search)
 * @param {string|null} seriesName - The series name if searching within a series
 * @returns {Promise<Object>} Classification with creamBadgeBooks, greenBadgeBooks, orangeBadgeBooks arrays
 */
async function classifyBookBadges(
  aiResponse,
  searchedQuery,
  searchedBook,
  seriesName,
) {
  if (!aiResponse) {
    return {
      creamBadgeBooks: [],
      greenBadgeBooks: [],
      orangeBadgeBooks: [],
    };
  }

  const markedBooks = extractMarkedTitles(aiResponse);
  const uniqueBooks = [...new Set(markedBooks)];

  if (uniqueBooks.length === 0) {
    return {
      creamBadgeBooks: [],
      greenBadgeBooks: [],
      orangeBadgeBooks: [],
    };
  }

  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error("OpenAI client not configured");
    }

    const isSeriesSearch = !searchedBook && seriesName;
    const isBookSearch = !!searchedBook;

    let systemContent;
    let userContent;

    if (isSeriesSearch) {
      systemContent = `You are a book classification expert. Classify books based on their relationship to a searched series.

BADGE COLOR RULES FOR SERIES SEARCH:
- CREAM: NEVER use cream for series searches (there is no specific searched book to match)
- GREEN: Individual book titles that belong to the searched series
- ORANGE: Books in a different series or standalone books
- NO BADGE: Series names themselves should NOT be classified (they're descriptive text, not book titles)

CRITICAL: Series names (like "Harry Potter", "The Lord of the Rings") are NOT book titles and should be EXCLUDED from classification. Only classify actual individual book titles.

IMPORTANT: When the user searches for a series name, ALL individual books in that series should be GREEN, never CREAM.`;

      userContent = `User searched for SERIES: "${seriesName}"
Corrected search term: "${searchedQuery}"
(No specific book was searched - the user searched for the series name itself)

Classify these extracted titles:
${uniqueBooks.map((book, i) => `${i + 1}. ${book}`).join("\n")}

For each title, determine:
1. Is this just the series name itself (e.g., "Harry Potter", "Lord of the Rings") OR a complete individual book title (e.g., "Harry Potter and the Philosopher's Stone", "The Fellowship of the Ring")?
2. If it's JUST the series name WITHOUT a subtitle (matches the searched series "${seriesName}"), respond with "SKIP" - series names should NOT be badged
3. If it's a COMPLETE individual book title with subtitle/book-specific name, classify it as:
   - GREEN: If it belongs to the searched series "${seriesName}"
   - ORANGE: If it's from a different series or standalone book

EXAMPLES for series search "Harry Potter":
- "Harry Potter" -> SKIP (series name only, no subtitle)
- "Harry Potter and the Philosopher's Stone" -> GREEN (individual book in searched series)
- "Harry Potter and the Chamber of Secrets" -> GREEN (individual book in searched series)
- "The Casual Vacancy" -> ORANGE (different book by same author, not in Harry Potter series)

EXAMPLES for series search "The Lord of the Rings":
- "The Lord of the Rings" -> SKIP (series name only)
- "Lord of the Rings" -> SKIP (series name only, just missing "The")
- "The Fellowship of the Ring" -> GREEN (individual book in searched series)
- "The Two Towers" -> GREEN (individual book in searched series)

Respond in JSON format:
{
  "classifications": [
    {"book": "Book Title", "color": "GREEN|ORANGE|SKIP", "reason": "brief explanation"},
    ...
  ]
}

CRITICAL: 
- Use SKIP for the series name itself when it appears without a subtitle/book-specific name
- Do NOT use CREAM for any books since this is a series search
- Only classify actual individual book titles as GREEN or ORANGE
IMPORTANT: Return ONLY valid JSON, no other text.`;
    } else if (isBookSearch) {
      systemContent = `You are a book classification expert. Classify books based on their relationship to a searched book.

BADGE COLOR RULES FOR BOOK SEARCH:
- CREAM: The exact same book as the searched book (only ONE book should get cream)
- GREEN: Books in the same series as the searched book (but NOT the searched book itself)
- ORANGE: Books in a different series or standalone books
- NO BADGE: Series names themselves should NOT be classified (they're descriptive text, not book titles)

CRITICAL: Series names (like "Harry Potter", "The Lord of the Rings") are NOT book titles and should be EXCLUDED from classification. Only classify actual individual book titles.

IMPORTANT: Only ONE book should get CREAM - the exact book that was searched. Even if a book is mentioned as an alternative title or edition, if it's essentially the same book, use CREAM.`;

      userContent = `User searched for BOOK: "${searchedBook}"
Corrected search term: "${searchedQuery}"
Series name: "${seriesName || "N/A"}"

Classify these extracted titles:
${uniqueBooks.map((book, i) => `${i + 1}. ${book}`).join("\n")}

For each title, determine:
1. Is this just a series name (e.g., "Harry Potter", "Lord of the Rings") OR a complete individual book title with subtitle (e.g., "Harry Potter and the Philosopher's Stone", "The Fellowship of the Ring")?
2. If it's JUST the series name WITHOUT subtitle/book-specific name (matches "${seriesName}"), respond with "SKIP" - series names should NOT be badged
3. If it's a COMPLETE individual book title, classify it as:
   - CREAM: If it's the exact book that was searched ("${searchedBook}")
   - GREEN: If it's in the same series ("${seriesName}") but a different book
   - ORANGE: If it's in a different series or standalone

EXAMPLES for book search "${searchedBook}"${seriesName ? ` (from series "${seriesName}")` : ""}:
${seriesName ? `- "${seriesName}" -> SKIP (series name only, no subtitle)\n- "Harry Potter" -> SKIP (series name only if that's the series name)\n` : ""}- "${searchedBook}" -> CREAM (the exact searched book)
- Other books in same series -> GREEN
- Books from different series -> ORANGE

Respond in JSON format:
{
  "classifications": [
    {"book": "Book Title", "color": "CREAM|GREEN|ORANGE|SKIP", "reason": "brief explanation"},
    ...
  ]
}

CRITICAL: 
- Use SKIP for the series name itself when it appears without a subtitle/book-specific name
- Series names like "${seriesName || "Harry Potter, Lord of the Rings, etc."}" should ALWAYS be SKIP
- Only classify actual individual book titles with complete names
IMPORTANT: Return ONLY valid JSON, no other text.`;
    } else {
      return {
        creamBadgeBooks: [],
        greenBadgeBooks: [],
        orangeBadgeBooks: uniqueBooks,
      };
    }

    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message.content.trim();

    let parsedResponse;
    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
        null,
        response,
      ];
      parsedResponse = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error("Failed to parse AI classification response:", response);
      return {
        creamBadgeBooks: [],
        greenBadgeBooks: [],
        orangeBadgeBooks: uniqueBooks,
      };
    }

    const creamBadgeBooks = [];
    const greenBadgeBooks = [];
    const orangeBadgeBooks = [];

    if (
      parsedResponse.classifications &&
      Array.isArray(parsedResponse.classifications)
    ) {
      for (const classification of parsedResponse.classifications) {
        const book = classification.book;
        const color = classification.color?.toUpperCase();

        if (color === "SKIP") {
          continue;
        } else if (color === "CREAM") {
          creamBadgeBooks.push(book);
        } else if (color === "GREEN") {
          greenBadgeBooks.push(book);
        } else {
          orangeBadgeBooks.push(book);
        }
      }
    }

    const titlesMatch = (title1, title2) => {
      if (!title1 || !title2) return false;
      const t1 = title1
        .toLowerCase()
        .trim()
        .replace(/^the\s+/i, "");
      const t2 = title2
        .toLowerCase()
        .trim()
        .replace(/^the\s+/i, "");
      return t1 === t2;
    };

    if (searchedBook) {
      const matchingBooks = uniqueBooks.filter((book) =>
        titlesMatch(book, searchedBook),
      );

      const removedFromGreen = greenBadgeBooks.filter(
        (book) => !titlesMatch(book, searchedBook),
      );
      const removedFromOrange = orangeBadgeBooks.filter(
        (book) => !titlesMatch(book, searchedBook),
      );

      const updatedCream = [...creamBadgeBooks, ...matchingBooks];
      const uniqueCream = [...new Set(updatedCream)];

      creamBadgeBooks.length = 0;
      creamBadgeBooks.push(...uniqueCream);

      greenBadgeBooks.length = 0;
      greenBadgeBooks.push(...removedFromGreen);

      orangeBadgeBooks.length = 0;
      orangeBadgeBooks.push(...removedFromOrange);
    }

    if (seriesName) {
      const seriesNameLower = seriesName.toLowerCase().trim();

      const matchesSeriesName = (book) => {
        const bookLower = book.toLowerCase().trim();
        return (
          bookLower === seriesNameLower ||
          bookLower === seriesNameLower.replace(/^the\s+/i, "") ||
          seriesNameLower === bookLower.replace(/^the\s+/i, "")
        );
      };

      const filterOutSeriesName = (books) =>
        books.filter((book) => !matchesSeriesName(book));

      const filteredCream = filterOutSeriesName(creamBadgeBooks);
      const filteredGreen = filterOutSeriesName(greenBadgeBooks);
      const filteredOrange = filterOutSeriesName(orangeBadgeBooks);

      return {
        creamBadgeBooks: filteredCream,
        greenBadgeBooks: filteredGreen,
        orangeBadgeBooks: filteredOrange,
      };
    }

    return {
      creamBadgeBooks,
      greenBadgeBooks,
      orangeBadgeBooks,
    };
  } catch (error) {
    console.error("Error classifying books with AI:", error);
    return {
      creamBadgeBooks: [],
      greenBadgeBooks: [],
      orangeBadgeBooks: uniqueBooks,
    };
  }
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

  const getBadgeColor = (bookTitle) => {
    const bookLower = bookTitle.toLowerCase().trim();

    if (
      classification.creamBadgeBooks.some(
        (book) => book.toLowerCase().trim() === bookLower,
      )
    ) {
      return "cream";
    }

    if (
      classification.greenBadgeBooks.some(
        (book) => book.toLowerCase().trim() === bookLower,
      )
    ) {
      return "green";
    }

    if (
      classification.orangeBadgeBooks.some(
        (book) => book.toLowerCase().trim() === bookLower,
      )
    ) {
      return "orange";
    }

    return null;
  };

  result = result.replace(
    /\[\[([^\]]+)\]\](\s+(?:series|trilogy|saga|collection))?/gi,
    (match, bookTitle, seriesIndicator) => {
      if (seriesIndicator) {
        return bookTitle + seriesIndicator;
      }

      const badgeColor = getBadgeColor(bookTitle);

      if (!badgeColor) {
        return bookTitle;
      }

      return `<span class="book-badge book-badge-${badgeColor}">${bookTitle}</span>`;
    },
  );

  const applyBadgeToMatch = (match, bookTitle, wrapInEm = false) => {
    const badgeColor = getBadgeColor(bookTitle);
    if (!badgeColor) return match;

    const content = wrapInEm ? `<em>${bookTitle}</em>` : bookTitle;
    return `<span class="book-badge book-badge-${badgeColor}">${content}</span>`;
  };

  result = result.replace(/[""]([^""]+)[""]/g, (match, bookTitle) =>
    applyBadgeToMatch(match, bookTitle),
  );

  result = result.replace(/\*([^*]+)\*/g, (match, bookTitle) =>
    applyBadgeToMatch(match, bookTitle, true),
  );

  return result;
}

module.exports = {
  classifyBookBadges,
  analyzeBookOrSeries,
  normalizeBookTitle,
  applyColoredBadges,
  extractMarkedTitles,
  extractQuotedTitles,
  isActualBookTitle,
};
