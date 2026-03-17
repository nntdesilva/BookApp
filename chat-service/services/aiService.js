const Anthropic = require("@anthropic-ai/sdk");
const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "aiService" });

let _anthropic = null;

function getClient() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: config.claude.apiKey });
  }
  return _anthropic;
}

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
        logger.warn({
          event: "claude_overloaded_retry",
          attempt: attempt + 1,
          maxAttempts: MAX_RETRIES + 1,
          delayMs: delay,
          status: err?.status,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (isOverloaded) {
        logger.error({
          event: "claude_overloaded_exhausted",
          maxAttempts: MAX_RETRIES + 1,
        });
        throw new Error(
          "The AI service is temporarily busy. Please try again in a moment.",
        );
      }
      throw err;
    }
  }
}

const META_PROMPT_SYSTEM = `You are a book assistant. Respond from your own knowledge unless the user explicitly requests an action that requires a tool call. NEVER call any tool proactively — only call a tool when the user's message directly and explicitly requests it. Auto-correct spelling errors in user queries.

## TAGGING
Tag EVERY occurrence of a real published book title (has ISBN) in your responses. Never tag author names, series names, publishers, genres, or characters. Same book = same tag throughout. Never nest tags.

### Decision Flow
1. If First message is a series name → books in that series get <book-in-series>; any book outside that series is <unrelated-book>. <original-book> never appears in this case. <original-book> can only be added if the first message is a standalone book.
2. First message is a standalone book → that book gets <original-book>; other books in its series get <book-in-series>; books from different topics get <unrelated-book>
3. Every follow-up message → apply the same rules; the original tag assignments from rule 1 or 2 never change

### Tag Types
- <original-book>: Only for the book the user asked about in the very first message of the session, and only if that first message was a standalone book (not a series). This designation is set once at session start and never re-assigned. If the session opened with a series name, <original-book> must never appear anywhere in the session.
- <book-in-series>: Strictly for books that belong to the series the user originally searched for. Never apply this tag to books from a different series or unrelated standalone books, even if mentioned in the same response.
- <unrelated-book>: Any book outside the original search topic — including any book the user asks about in a follow-up when the session started with a series name.

### Tagging rules
- Wrap EVERY single occurrence of a book title — in every sentence, paragraph, inline mention, heading line, standalone label, or any other context. This includes the very first time the book title appears (even if it is the opening sentence or a standalone heading). Zero exceptions: if the text of a book title appears anywhere in your response, it must be inside its tag.
- A book title used as or inside a heading must still be tagged. There is no location or context in a response where a book title may appear untagged.
- Same book = same tag throughout the entire response without exception. Never nest tags.
- Auto-correct spelling errors in user queries. Provide comprehensive, informative responses.

## FAVORITES
Only add individual books with ISBN-13. Never ISBN-10, never series names.
When listing favorites, show only titles — never ISBNs.


## FAVORITES (add_to_favorites, remove_from_favorites, list_favorites)
- ONLY add individual books with ISBN-13 (13 digits). Never ISBN-10. Never series names.
- If user asks to add a SERIES: ask "Would you like to add all books in [series] or a specific one?" Wait for response before calling any function.
- If confirmed "add all": call add_to_favorites for EACH book with its ISBN-13. You MUST provide correct ISBN-13s.
- When listing favorites: show ONLY titles — never display ISBNs to the user.

## WORD SEARCH (Project Gutenberg — public domain only, pre-1928)
1. ONLY call count_word_in_book when the user explicitly asks to count or search for a specific word or phrase — never call proactively.
2. Call count_word_in_book directly with the book title and search term — resolution is handled internally.
3. Use ONLY for counting a single word or phrase in isolation (e.g., "how many times does 'love' appear").
4. For series queries, ask which specific book first. Auto-correct misspelled titles.
5. Execute silently — don't announce steps. Modern books are unavailable — explain if asked.

## SEMANTIC SEARCH (count_related_words_in_book)
- ONLY call when the user explicitly asks to find or count words related to a concept — never call proactively.
- Use for concept/category queries (e.g., "flower-related words", "colors"). Use count_word_in_book for single specific words instead.
- List EACH word individually sorted highest first: "- **word** — X times". Optionally add total at end.
- Same public-domain/series rules. Execute silently.

## BOOK STATISTICS (analyze_book_statistics)
- ONLY call when the user explicitly asks for a statistic, analysis, or pattern about a book's text — never call proactively for general questions about a book's content, themes, characters, or plot.
- Use for questions that require computing relationships between parts of the text: co-occurrence of multiple words in the same sentence/paragraph, sentence structure, word distributions, readability metrics, chapter analysis, or any other computable statistic that goes beyond counting a single word in isolation.
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

## OUTPUT FORMAT — CRITICAL
- Write ALL responses in plain text paragraph format. No markdown headings (#, ##, ###), no horizontal rules (---), no tables (| ... |), no bullet-point-heavy lists.
- You MAY use emojis freely.
- You MAY use short bullet points sparingly for genuinely list-like data (e.g. award names), but never for sections that read naturally as prose.
- Structure your response as flowing paragraphs. Use emojis as inline section indicators if desired (e.g. "📖 Overview — ..."), but never as markdown headings.

## CRITICAL RULES
- NEVER refuse to call a tool because of book length or size. The backend handles large texts internally — you must ALWAYS call the appropriate tool regardless of how long the book is.
- When a question requires text analysis, ALWAYS call the tool. Never answer with estimates, guesses, or refusals about size limits.`;

const FAVORITE_FUNCTIONS = [
  {
    name: "add_to_favorites",
    description:
      "Add a book to the user's favorites list. Only use for individual books with valid ISBN-13, never for series names. ONLY call when the user explicitly asks to add a book to favorites. Never call proactively.",
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
    description:
      "Remove a book from the user's favorites list by ISBN-13. ONLY call when the user explicitly asks to remove a book from favorites. Never call proactively.",
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
      "List all books in the user's favorites list. ONLY call when the user explicitly asks to see, view, or show their favorites list. Never call proactively.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "remove_all_favorites",
    description:
      "Remove ALL books from the user's favorites list at once. ONLY call when the user explicitly asks to clear, remove all, or empty their entire favorites list. Never call proactively.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

const WORD_SEARCH_FUNCTIONS = [
  {
    name: "count_word_in_book",
    description:
      "Count how many times a word or phrase appears in a book's full text. Only works for books available in Project Gutenberg (public domain). Handles case-insensitivity and multi-word phrases. ONLY call when the user explicitly asks to count or search for a word or phrase. Never call proactively.",
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
      "Find and count ALL words semantically related to a concept or category in a book's full text. Uses embeddings to identify related words (synonyms, variations, specific examples) and counts each occurrence precisely. Only works for public domain books in Project Gutenberg. ONLY call when the user explicitly asks to find or count words related to a concept. Never call proactively.",
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
      "Analyze any arbitrary statistic, pattern, or structural property of a book's full text using code execution. Use this for complex questions that go beyond simple word counting — such as sentence analysis, co-occurrence patterns, word distributions, chapter analysis, readability metrics, or ANY computable statistic about the text. Only works for public domain books available in Project Gutenberg. ONLY call when the user explicitly asks for a text analysis, statistic, or pattern about a book. Never call proactively.",
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
      "Generate an interactive visualization (chart, graph, diagram) of book text analysis results. ONLY call when the user explicitly asks to visualize, chart, graph, or plot data about a book's text. Creates a rich interactive chart displayed directly in the UI. Only works for public domain books available in Project Gutenberg. Never call proactively.",
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
  const t0 = Date.now();
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

    logger.info({
      event: "claude_call",
      model: config.claude.model,
      historyMessages: conversationHistory.length,
      toolCount: ALL_TOOLS.length,
    });

    const response = await callWithRetry(() =>
      getClient().messages.create({
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

    logger.info({
      event: "claude_response",
      stopReason: response.stop_reason,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      toolCallCount: toolUseBlocks.length,
      durationMs: Date.now() - t0,
    });

    if (toolUseBlocks.length > 0) {
      const callNames = toolUseBlocks.map((b) => b.name);
      logger.info({ event: "tool_calls_requested", functions: callNames });
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
    logger.error({
      event: "generate_chat_response_failed",
      durationMs: Date.now() - t0,
      err: error,
    });
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
  const t0 = Date.now();
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

    const resultNames = functionResults.map((r) => r.name);
    logger.info({
      event: "claude_continuation",
      completedFunctions: resultNames,
      model: config.claude.model,
    });

    const response = await callWithRetry(() =>
      getClient().messages.create({
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

    logger.info({
      event: "claude_continuation_response",
      stopReason: response.stop_reason,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      furtherToolCallCount: toolUseBlocks.length,
      durationMs: Date.now() - t0,
    });

    if (toolUseBlocks.length > 0) {
      const callNames = toolUseBlocks.map((b) => b.name);
      logger.info({
        event: "further_tool_calls_requested",
        functions: callNames,
      });
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
    logger.error({
      event: "continue_after_function_failed",
      durationMs: Date.now() - t0,
      err: error,
    });
    return {
      error: error.message || "Failed to generate response. Please try again.",
    };
  }
}

module.exports = {
  generateChatResponse,
  continueAfterFunctionExecution,
};
