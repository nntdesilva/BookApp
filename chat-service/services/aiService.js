const { ChatAnthropic } = require("@langchain/anthropic");
const { SystemMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const favoritesClient = require("../clients/favoritesClient");
const booksClient = require("../clients/booksClient");
const analysisClient = require("../clients/analysisClient");
const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "aiService" });

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const META_PROMPT_SYSTEM = `You are a book assistant. Respond from your own knowledge unless the user explicitly requests an action that requires a tool call. NEVER call any tool proactively — only call a tool when the user's message directly and explicitly requests it. Auto-correct spelling errors in user queries.

## TAGGING

Tag EVERY occurrence of a real published book title (has an ISBN) in your responses. Never tag author names, series names, publishers, genres, or characters. Never nest tags.

### Step 1 — Lock session mode on the first message (permanent, never changes)

Read the very first user message and classify it exactly once:
- User mentioned a series name only (no specific installment) → session is **SERIES-OPENED**
- User mentioned a specific book title (even if that book belongs to a series) → session is **BOOK-OPENED**

Every follow-up message in the conversation inherits this same session mode. Never reclassify.

### Step 2 — Tag every book title in your response based on session mode

**In a SERIES-OPENED session:**
For each book title, ask: does this book belong to the original series?
- Yes → <book-in-series>
- No → <unrelated-book>
- ⛔ NEVER use <original-book> anywhere in a SERIES-OPENED session. It is completely forbidden.

**In a BOOK-OPENED session:**
For each book title, apply these checks in strict order — the first match wins, stop checking:
1. Is this the exact book the user mentioned in the first message? → <original-book>. This check always takes absolute priority, regardless of whether the book belongs to a series.
2. Is this book part of the same series as that original book? → <book-in-series>
3. Otherwise → <unrelated-book>

### Step 3 — Wrap and enforce
- Wrap EVERY occurrence of every book title in its assigned tag — in every sentence, paragraph, heading, inline mention, or any other context. No location is exempt.
- Same book = same tag for the entire response, without exception.
- Never nest tags.

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

// ---------------------------------------------------------------------------
// Model singleton — raw model; createReactAgent binds tools internally.
// maxRetries replaces the hand-rolled callWithRetry / exponential-backoff loop.
// ---------------------------------------------------------------------------

let _model = null;

function getModel() {
  if (!_model) {
    _model = new ChatAnthropic({
      apiKey: config.claude.apiKey,
      model: config.claude.model,
      temperature: config.claude.temperature,
      maxTokens: config.claude.maxTokens,
      maxRetries: 3,
    });
  }
  return _model;
}

// ---------------------------------------------------------------------------
// Tool factory — creates per-request tools with userId bound.
// The generate_visualization tool captures HTML as a side-effect so it can
// be returned to the caller without sending the full markup back to the LLM.
// ---------------------------------------------------------------------------

function createTools(userId) {
  let capturedVisualizationHtml = null;

  const tools = [
    tool(
      async ({ isbn13, title }) => {
        logger.info({ event: "tool_add_favorite", userId, isbn13, title });
        const result = await favoritesClient.addFavorite(userId, isbn13, title);
        return JSON.stringify(result);
      },
      {
        name: "add_to_favorites",
        description:
          "Add a book to the user's favorites list. Only use for individual books with valid ISBN-13, never for series names. ONLY call when the user explicitly asks to add a book to favorites. Never call proactively.",
        schema: z.object({
          isbn13: z
            .string()
            .describe(
              "The ISBN-13 of the book (exactly 13 digits, no hyphens). Must be a valid ISBN-13.",
            ),
          title: z.string().describe("The full title of the book"),
        }),
      },
    ),

    tool(
      async ({ isbn13 }) => {
        logger.info({ event: "tool_remove_favorite", userId, isbn13 });
        const result = await favoritesClient.removeFavorite(userId, isbn13);
        return JSON.stringify(result);
      },
      {
        name: "remove_from_favorites",
        description:
          "Remove a book from the user's favorites list by ISBN-13. ONLY call when the user explicitly asks to remove a book from favorites. Never call proactively.",
        schema: z.object({
          isbn13: z
            .string()
            .describe("The ISBN-13 of the book to remove (exactly 13 digits)"),
        }),
      },
    ),

    tool(
      async () => {
        logger.info({ event: "tool_list_favorites", userId });
        const result = await favoritesClient.listFavorites(userId);
        return JSON.stringify(result);
      },
      {
        name: "list_favorites",
        description:
          "List all books in the user's favorites list. ONLY call when the user explicitly asks to see, view, or show their favorites list. Never call proactively.",
        schema: z.object({}),
      },
    ),

    tool(
      async () => {
        logger.info({ event: "tool_remove_all_favorites", userId });
        const result = await favoritesClient.clearFavorites(userId);
        return JSON.stringify(result);
      },
      {
        name: "remove_all_favorites",
        description:
          "Remove ALL books from the user's favorites list at once. ONLY call when the user explicitly asks to clear, remove all, or empty their entire favorites list. Never call proactively.",
        schema: z.object({}),
      },
    ),

    tool(
      async ({ bookTitle, searchTerm }) => {
        logger.info({ event: "tool_count_word", userId, bookTitle, searchTerm });
        const result = await booksClient.countWordInBook(bookTitle, searchTerm);
        return JSON.stringify(result);
      },
      {
        name: "count_word_in_book",
        description:
          "Count how many times a word or phrase appears in a book's full text. Only works for books available in Project Gutenberg (public domain). Handles case-insensitivity and multi-word phrases. ONLY call when the user explicitly asks to count or search for a word or phrase. Never call proactively.",
        schema: z.object({
          bookTitle: z
            .string()
            .describe(
              "The title of the book to search in (use the corrected/proper title)",
            ),
          searchTerm: z
            .string()
            .describe(
              "The word or phrase to count occurrences of (can be multiple words, case-insensitive)",
            ),
        }),
      },
    ),

    tool(
      async ({ bookTitle, concept }) => {
        logger.info({ event: "tool_count_related", userId, bookTitle, concept });
        const result = await booksClient.countRelatedWordsInBook(bookTitle, concept);
        return JSON.stringify(result);
      },
      {
        name: "count_related_words_in_book",
        description:
          "Find and count ALL words semantically related to a concept or category in a book's full text. Uses embeddings to identify related words (synonyms, variations, specific examples) and counts each occurrence precisely. Only works for public domain books in Project Gutenberg. ONLY call when the user explicitly asks to find or count words related to a concept. Never call proactively.",
        schema: z.object({
          bookTitle: z
            .string()
            .describe(
              "The title of the book to search in (use the corrected/proper title)",
            ),
          concept: z
            .string()
            .describe(
              "The concept or category to find related words for (e.g., 'flowers', 'war', 'emotions', 'colors')",
            ),
        }),
      },
    ),

    tool(
      async ({ bookTitle, question }) => {
        logger.info({ event: "tool_analyze_statistics", userId, bookTitle });
        const result = await analysisClient.analyzeBookStatistics(bookTitle, question);
        return JSON.stringify(result);
      },
      {
        name: "analyze_book_statistics",
        description:
          "Analyze any arbitrary statistic, pattern, or structural property of a book's full text using code execution. Use this for complex questions that go beyond simple word counting — such as sentence analysis, co-occurrence patterns, word distributions, chapter analysis, readability metrics, or ANY computable statistic about the text. Only works for public domain books available in Project Gutenberg. ONLY call when the user explicitly asks for a text analysis, statistic, or pattern about a book. Never call proactively.",
        schema: z.object({
          bookTitle: z
            .string()
            .describe(
              "The title of the book to analyze (use the corrected/proper title)",
            ),
          question: z
            .string()
            .describe(
              "The user's question or statistic they want to know about the book's text. Be specific and include all relevant details from the user's request.",
            ),
        }),
      },
    ),

    tool(
      async ({ bookTitle, question, chartType }) => {
        logger.info({ event: "tool_generate_visualization", userId, bookTitle, chartType });
        const result = await analysisClient.generateVisualization(bookTitle, question, chartType);
        if (result.success && result.html) {
          capturedVisualizationHtml = result.html;
          logger.info({
            event: "visualization_captured",
            userId,
            bookTitle,
            htmlLength: result.html.length,
          });
          // Return a stripped-down summary — not the full HTML — so the LLM
          // doesn't receive megabytes of markup in its context window.
          return JSON.stringify({
            success: true,
            bookTitle: result.bookTitle,
            authors: result.authors,
            message: "Interactive visualization has been generated and will be displayed to the user.",
          });
        }
        return JSON.stringify(result);
      },
      {
        name: "generate_visualization",
        description:
          "Generate an interactive visualization (chart, graph, diagram) of book text analysis results. ONLY call when the user explicitly asks to visualize, chart, graph, or plot data about a book's text. Creates a rich interactive chart displayed directly in the UI. Only works for public domain books available in Project Gutenberg. Never call proactively.",
        schema: z.object({
          bookTitle: z
            .string()
            .describe(
              "The title of the book to analyze and visualize (use the corrected/proper title)",
            ),
          question: z
            .string()
            .describe(
              "What data to compute and visualize from the book's text (e.g., 'top 10 most common words', 'sentence length distribution'). IMPORTANT: Never add 'excluding stop words' or any filtering language — always request raw unfiltered counts.",
            ),
          chartType: z
            .string()
            .describe(
              "The type of chart to create: 'bar chart', 'pie chart', 'line chart', 'scatter plot', 'heatmap', 'sankey diagram', 'histogram', 'treemap', or any other valid chart type. If user doesn't specify, choose the most appropriate type for the data.",
            ),
        }),
      },
    ),
  ];

  return { tools, getVisualizationHtml: () => capturedVisualizationHtml };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function runChatTurn(message, conversationHistory = [], userId) {
  const t0 = Date.now();
  try {
    if (!message || typeof message !== "string") {
      throw new Error("Invalid message format");
    }

    if (!config.claude.apiKey) {
      throw new Error("Anthropic API key is not configured");
    }

    const { tools, getVisualizationHtml } = createTools(userId);

    const agent = createReactAgent({
      llm: getModel(),
      tools,
      // String prompt is converted to a SystemMessage prepended to every LLM call.
      prompt: META_PROMPT_SYSTEM,
    });

    logger.info({
      event: "agent_run_start",
      model: config.claude.model,
      historyMessages: conversationHistory.length,
      toolCount: tools.length,
      userId,
    });

    // Pass the full conversation history + the new user message as the graph
    // input. The agent appends its intermediate and final messages in-place,
    // so result.messages is the complete post-turn message list.
    const result = await agent.invoke(
      { messages: [...conversationHistory, new HumanMessage(message)] },
      { recursionLimit: 25 },
    );

    const allMessages = result.messages;
    const finalMessage = allMessages[allMessages.length - 1];
    const finalText = extractText(finalMessage.content);

    logger.info({
      event: "agent_run_complete",
      totalMessages: allMessages.length,
      durationMs: Date.now() - t0,
      userId,
    });

    // Persist only the user turn + final assistant reply (not intermediate
    // tool-call messages) to keep Redis history compact and well-formed.
    const updatedHistory = [
      ...conversationHistory,
      new HumanMessage(message),
      new AIMessage(finalText),
    ];

    return {
      success: true,
      response: finalText,
      conversationHistory: updatedHistory,
      visualizationHtml: getVisualizationHtml(),
    };
  } catch (error) {
    logger.error({
      event: "run_chat_turn_failed",
      durationMs: Date.now() - t0,
      userId,
      err: error,
    });
    return {
      error: error.message || "Failed to generate response. Please try again.",
    };
  }
}

module.exports = { runChatTurn, createTools };
