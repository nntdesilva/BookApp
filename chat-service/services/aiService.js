const Anthropic = require("@anthropic-ai/sdk");
const config = require("../config/appConfig");

const anthropic = new Anthropic({
  apiKey: config.claude.apiKey,
});

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

async function callWithRetry(fn) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isOverloaded =
        err?.status === 529 ||
        (err?.message && err.message.includes("overloaded_error"));
      if (isOverloaded && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (isOverloaded) {
        throw new Error(
          "The AI service is temporarily busy. Please try again in a moment.",
        );
      }
      throw err;
    }
  }
}

const META_PROMPT_SYSTEM = `You are a knowledgeable book expert assistant. Provide accurate book/series information with strict tagging, favorites management, and text analysis.

## TAGGING — Only tag real published book titles with ISBNs
NEVER tag author names, series names, publishers, genres, or characters.

### Tag Types
- <original-book>: The specific original book the user searched for. Tag EVERY mention throughout your response.
- <book-in-series>: Individual books listed when user searched a SERIES NAME. If user searched a specific book in a series: that book = <original-book>, others in series = <book-in-series>.
- <unrelated-book>: Books unrelated to the original search topic, mentioned in follow-up conversations.

### Decision Flow
1. Query is a series name → all individual books get <book-in-series>
2. Query is a specific book → that book gets <original-book> everywhere; other books in same series get <book-in-series>
3. Follow-up about different topic → new books get <unrelated-book>

### Formatting
- Use complete, correctly-spelled book titles. Same book = same tag throughout. Never nest tags.
- Auto-correct spelling errors in user queries. Provide comprehensive, informative responses.

## FAVORITES (add_to_favorites, remove_from_favorites, list_favorites)
- ONLY add individual books with ISBN-13 (13 digits). Never ISBN-10. Never series names.
- If user asks to add a SERIES: ask "Would you like to add all books in [series] or a specific one?" Wait for response before calling any function.
- If confirmed "add all": call add_to_favorites for EACH book with its ISBN-13. You MUST provide correct ISBN-13s.
- When listing favorites: show ONLY titles — never display ISBNs to the user.

## WORD SEARCH (Project Gutenberg — public domain only, pre-1928)
1. Call resolve_book_for_search to verify availability, then count_word_in_book with title and search term.
2. Use ONLY for counting a single word or phrase in isolation (e.g., "how many times does 'love' appear").
3. For series queries, ask which specific book first. Auto-correct misspelled titles.
4. Execute silently — don't announce steps. Modern books are unavailable — explain if asked.

## SEMANTIC SEARCH (count_related_words_in_book)
- Use for concept/category queries (e.g., "flower-related words", "colors"). Use count_word_in_book for single specific words instead.
- Do NOT call resolve_book_for_search before this — it handles resolution internally.
- List EACH word individually sorted highest first: "- **word** — X times". Optionally add total at end.
- Same public-domain/series rules. Execute silently.

## BOOK STATISTICS (analyze_book_statistics)
- Use for ANY question that requires reasoning about relationships between parts of the text: co-occurrence of multiple words in the same sentence/paragraph, sentence structure, word distributions, readability metrics, chapter analysis, or any other computable statistic that goes beyond counting a single word in isolation.
- MANDATORY for co-occurrence questions (e.g., "how many sentences contain both X and Y", "how often do X and Y appear together"): count_word_in_book counts words independently and CANNOT answer co-occurrence — always use analyze_book_statistics for these.
- When formulating the question parameter for word frequency analysis, NEVER include "excluding stop words", "without common words", or any filtering language. Always request raw unfiltered word counts covering every word in the text.
- Same public-domain/series rules. Execute silently. Present results conversationally — never mention "code interpreter".

## VISUALIZATION (generate_visualization)
- Use ONLY when user explicitly asks to visualize/chart/graph/plot data.
- Infer book and topic from context when user says "visualize it" after previous analysis.
- Default chart types if unspecified: comparisons→bar, proportions→pie, trends→line, distributions→histogram.
- The question parameter must be worded IDENTICALLY regardless of chart type so that cached analysis data is reused.
- NEVER add "excluding stop words", "without common words", or any filtering language to the question parameter. Word frequency must always reflect raw, unfiltered counts of every word in the text from first word to last word — no exceptions.
- Execute silently. Provide brief text description after visualization.

## CRITICAL RULES
- NEVER refuse to call a tool because of book length or size. The backend handles large texts internally — you must ALWAYS call the appropriate tool regardless of how long the book is.
- When a question requires text analysis, ALWAYS call the tool. Never answer with estimates, guesses, or refusals about size limits.`;

const FAVORITE_FUNCTIONS = [
  {
    name: "add_to_favorites",
    description:
      "Add a book to the user's favorites list. Only use for individual books with valid ISBN-13, never for series names.",
    input_schema: {
      type: "object",
      properties: {
        isbn13: {
          type: "string",
          description:
            "The ISBN-13 of the book (exactly 13 digits, no hyphens). Must be a valid ISBN-13.",
        },
        title: {
          type: "string",
          description: "The full title of the book",
        },
      },
      required: ["isbn13", "title"],
    },
  },
  {
    name: "remove_from_favorites",
    description: "Remove a book from the user's favorites list by ISBN-13",
    input_schema: {
      type: "object",
      properties: {
        isbn13: {
          type: "string",
          description: "The ISBN-13 of the book to remove (exactly 13 digits)",
        },
      },
      required: ["isbn13"],
    },
  },
  {
    name: "list_favorites",
    description:
      "List all books in the user's favorites list. Call this when user asks to see their favorites.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "remove_all_favorites",
    description:
      "Remove ALL books from the user's favorites list at once. Use when the user asks to clear, remove all, or empty their entire favorites list.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

const WORD_SEARCH_FUNCTIONS = [
  {
    name: "resolve_book_for_search",
    description:
      "Check if a book is available for full-text search in Project Gutenberg. Use this to verify availability before counting words. Only works for public domain books (published before 1928).",
    input_schema: {
      type: "object",
      properties: {
        bookTitle: {
          type: "string",
          description:
            "The title of the book to search for (use the corrected/proper title, not misspelled versions)",
        },
      },
      required: ["bookTitle"],
    },
  },
  {
    name: "count_word_in_book",
    description:
      "Count how many times a word or phrase appears in a book's full text. Only works for books available in Project Gutenberg (public domain). Handles case-insensitivity and multi-word phrases.",
    input_schema: {
      type: "object",
      properties: {
        bookTitle: {
          type: "string",
          description:
            "The title of the book to search in (use the corrected/proper title)",
        },
        searchTerm: {
          type: "string",
          description:
            "The word or phrase to count occurrences of (can be multiple words, case-insensitive)",
        },
      },
      required: ["bookTitle", "searchTerm"],
    },
  },
  {
    name: "count_related_words_in_book",
    description:
      "Find and count ALL words semantically related to a concept or category in a book's full text. Uses embeddings to identify related words (synonyms, variations, specific examples) and counts each occurrence precisely. Only works for public domain books in Project Gutenberg.",
    input_schema: {
      type: "object",
      properties: {
        bookTitle: {
          type: "string",
          description:
            "The title of the book to search in (use the corrected/proper title)",
        },
        concept: {
          type: "string",
          description:
            "The concept or category to find related words for (e.g., 'flowers', 'war', 'emotions', 'colors')",
        },
      },
      required: ["bookTitle", "concept"],
    },
  },
];

const TEXT_ANALYSIS_FUNCTIONS = [
  {
    name: "analyze_book_statistics",
    description:
      "Analyze any arbitrary statistic, pattern, or structural property of a book's full text using code execution. Use this for complex questions that go beyond simple word counting — such as sentence analysis, co-occurrence patterns, word distributions, chapter analysis, readability metrics, or ANY computable statistic about the text. Only works for public domain books available in Project Gutenberg.",
    input_schema: {
      type: "object",
      properties: {
        bookTitle: {
          type: "string",
          description:
            "The title of the book to analyze (use the corrected/proper title)",
        },
        question: {
          type: "string",
          description:
            "The user's question or statistic they want to know about the book's text. Be specific and include all relevant details from the user's request.",
        },
      },
      required: ["bookTitle", "question"],
    },
  },
];

const VISUALIZATION_FUNCTIONS = [
  {
    name: "generate_visualization",
    description:
      "Generate an interactive visualization (chart, graph, diagram) of book text analysis results. Use this when the user explicitly asks to visualize, chart, graph, or plot data about a book's text. Creates a rich interactive chart displayed directly in the UI. Only works for public domain books available in Project Gutenberg.",
    input_schema: {
      type: "object",
      properties: {
        bookTitle: {
          type: "string",
          description:
            "The title of the book to analyze and visualize (use the corrected/proper title)",
        },
        question: {
          type: "string",
          description:
            "What data to compute and visualize from the book's text (e.g., 'top 10 most common words', 'sentence length distribution', 'distribution of question vs statement sentences'). IMPORTANT: Never add 'excluding stop words' or any filtering language — always request raw unfiltered counts.",
        },
        chartType: {
          type: "string",
          description:
            "The type of chart to create: 'bar chart', 'pie chart', 'line chart', 'scatter plot', 'heatmap', 'sankey diagram', 'histogram', 'treemap', or any other valid chart type. If user doesn't specify, choose the most appropriate type for the data.",
        },
      },
      required: ["bookTitle", "question", "chartType"],
    },
  },
];

const ALL_TOOLS = [
  ...FAVORITE_FUNCTIONS,
  ...WORD_SEARCH_FUNCTIONS,
  ...TEXT_ANALYSIS_FUNCTIONS,
  ...VISUALIZATION_FUNCTIONS,
];

async function generateChatResponse(message, conversationHistory = []) {
  try {
    if (!message || typeof message !== "string") {
      throw new Error("Invalid message format");
    }

    if (!config.claude.apiKey) {
      throw new Error("Anthropic API key is not configured");
    }

    const messages = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const response = await callWithRetry(() =>
      anthropic.messages.create({
        model: config.claude.model,
        system: META_PROMPT_SYSTEM,
        messages: messages,
        temperature: config.claude.temperature,
        max_tokens: config.claude.maxTokens,
        tools: ALL_TOOLS,
      }),
    );

    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use",
    );

    if (toolUseBlocks.length > 0) {
      return {
        success: true,
        requiresFunctionExecution: true,
        functionCalls: toolUseBlocks.map((block) => ({
          id: block.id,
          name: block.name,
          arguments: block.input,
        })),
        assistantMessage: response,
        conversationHistory: [
          ...conversationHistory,
          { role: "user", content: message },
        ],
      };
    }

    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const updatedHistory = [
      ...conversationHistory,
      { role: "user", content: message },
      { role: "assistant", content: response.content },
    ];

    return {
      success: true,
      response: textContent,
      conversationHistory: updatedHistory,
    };
  } catch (error) {
    console.error("[chat-service] Error generating chat response:", error);
    return {
      error: error.message || "Failed to generate response. Please try again.",
    };
  }
}

async function continueAfterFunctionExecution(
  conversationHistory,
  assistantMessage,
  functionResults,
) {
  try {
    const assistantContent = assistantMessage.content;

    const toolResultContent = functionResults.map((result) => ({
      type: "tool_result",
      tool_use_id: result.id,
      content: JSON.stringify(result.result),
    }));

    const messages = [
      ...conversationHistory,
      { role: "assistant", content: assistantContent },
      { role: "user", content: toolResultContent },
    ];

    const response = await callWithRetry(() =>
      anthropic.messages.create({
        model: config.claude.model,
        system: META_PROMPT_SYSTEM,
        messages: messages,
        temperature: config.claude.temperature,
        max_tokens: config.claude.maxTokens,
        tools: ALL_TOOLS,
      }),
    );

    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use",
    );

    if (toolUseBlocks.length > 0) {
      return {
        success: true,
        requiresFunctionExecution: true,
        functionCalls: toolUseBlocks.map((block) => ({
          id: block.id,
          name: block.name,
          arguments: block.input,
        })),
        assistantMessage: response,
        conversationHistory: [
          ...conversationHistory,
          { role: "assistant", content: assistantContent },
          { role: "user", content: toolResultContent },
        ],
      };
    }

    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const updatedHistory = [
      ...conversationHistory,
      { role: "assistant", content: assistantContent },
      { role: "user", content: toolResultContent },
      { role: "assistant", content: response.content },
    ];

    return {
      success: true,
      response: textContent,
      conversationHistory: updatedHistory,
    };
  } catch (error) {
    console.error("[chat-service] Error continuing after tool execution:", error);
    return {
      error: error.message || "Failed to generate response. Please try again.",
    };
  }
}

module.exports = {
  generateChatResponse,
  continueAfterFunctionExecution,
};
