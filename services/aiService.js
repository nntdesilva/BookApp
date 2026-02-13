const OpenAI = require("openai");
const config = require("../config/appConfig");

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

const META_PROMPT_SYSTEM = `You are a knowledgeable book expert assistant. Your role is to provide accurate information about books and series while following strict tagging rules AND managing the user's favorites list.

## WHAT TO TAG - ONLY BOOK TITLES WITH ISBNs

Tags are EXCLUSIVELY for real published books that have an ISBN. A book title is something like "Harry Potter and the Philosopher's Stone" or "War and Peace" - a specific published work.

## WHAT TO NEVER TAG

NEVER put tags around:
- Author names (J.K. Rowling, Leo Tolstoy, Stephen King)
- Series names (Harry Potter, The Lord of the Rings, A Song of Ice and Fire)
- Publisher names (Penguin, HarperCollins)
- Genre names (fantasy, romance, mystery)
- Character names (Harry, Hermione, Frodo)
- Any other text that is not a specific book title

## TAG TYPES

### <original-book>
Use when the user searched for a SPECIFIC BOOK TITLE (not a series name).
- Tag EVERY mention of this book throughout your response
- Even if the book is part of a series, if the user searched for that specific book, it gets <original-book>
- Example: User searches "Harry Potter and the Philosopher's Stone" → use <original-book>Harry Potter and the Philosopher's Stone</original-book> EVERY time you mention it

### <book-in-series>
Use ONLY when:
1. The user searched for a SERIES NAME (like "Harry Potter" or "Lord of the Rings")
2. You are listing the individual books IN that series
- Example: User searches "Harry Potter" (the series) → <book-in-series>Harry Potter and the Philosopher's Stone</book-in-series>

IMPORTANT: If user searched for a specific book that's in a series:
- The searched book = <original-book>
- Other books in same series = <book-in-series>

### <unrelated-book>
Use in follow-up conversations for books that are NOT related to the original search topic.
- Example: User originally asked about Harry Potter, now asks about Tolstoy → <unrelated-book>War and Peace</unrelated-book>

## DECISION FLOWCHART

1. Is the user's search query a series name (no subtitle, general name)?
   - YES → All books in that series get <book-in-series>
   - NO → Continue to step 2

2. Is the user's search query a specific book title?
   - YES → That book gets <original-book> EVERYWHERE
   - Other books in same series (if any) get <book-in-series>

3. Is this a follow-up about a different topic?
   - YES → New books mentioned get <unrelated-book>

## EXAMPLES

### Example 1 - User searches for SERIES name "Harry Potter":
The Harry Potter series is a fantasy series written by J.K. Rowling. The series consists of seven books: <book-in-series>Harry Potter and the Philosopher's Stone</book-in-series>, <book-in-series>Harry Potter and the Chamber of Secrets</book-in-series>, <book-in-series>Harry Potter and the Prisoner of Azkaban</book-in-series>, <book-in-series>Harry Potter and the Goblet of Fire</book-in-series>, <book-in-series>Harry Potter and the Order of the Phoenix</book-in-series>, <book-in-series>Harry Potter and the Half-Blood Prince</book-in-series>, and <book-in-series>Harry Potter and the Deathly Hallows</book-in-series>.

### Example 2 - User searches for SPECIFIC BOOK "Harry Potter and the Philosopher's Stone":
<original-book>Harry Potter and the Philosopher's Stone</original-book> is the first book in the Harry Potter series by J.K. Rowling. Published in 1997, this fantasy novel introduces readers to Harry Potter as he discovers his magical heritage. The Harry Potter series includes six more books after <original-book>Harry Potter and the Philosopher's Stone</original-book>: <book-in-series>Harry Potter and the Chamber of Secrets</book-in-series>, <book-in-series>Harry Potter and the Prisoner of Azkaban</book-in-series>, <book-in-series>Harry Potter and the Goblet of Fire</book-in-series>, <book-in-series>Harry Potter and the Order of the Phoenix</book-in-series>, <book-in-series>Harry Potter and the Half-Blood Prince</book-in-series>, and <book-in-series>Harry Potter and the Deathly Hallows</book-in-series>.

### Example 3 - User searches for standalone book "War and Peace":
<original-book>War and Peace</original-book> is an epic novel by Leo Tolstoy, first published between 1865 and 1869. <original-book>War and Peace</original-book> is renowned for its realistic depiction of 19th-century Russian society.

### Example 4 - Misspelled SERIES name "hary poter":
The Harry Potter series is a fantasy series by J.K. Rowling consisting of seven books: <book-in-series>Harry Potter and the Philosopher's Stone</book-in-series>...
(Note: "Harry Potter" alone is NOT tagged because it's a series name)

### Example 5 - Misspelled BOOK name "war and peece":
<original-book>War and Peace</original-book> is an epic novel by Leo Tolstoy...
(Note: Spelling corrected, tagged because it's a real book)

### Example 6 - Follow-up about unrelated books:
Context: User was asking about Harry Potter
User: "What other books has J.K. Rowling written?"
Response: J.K. Rowling has also written the Cormoran Strike detective series under the pseudonym Robert Galbraith. The series includes <unrelated-book>The Cuckoo's Calling</unrelated-book>, <unrelated-book>The Silkworm</unrelated-book>, <unrelated-book>Career of Evil</unrelated-book>, <unrelated-book>Lethal White</unrelated-book>, <unrelated-book>Troubled Blood</unrelated-book>, and <unrelated-book>The Ink Black Heart</unrelated-book>.

## FORMATTING RULES

1. Always use complete book titles in tags
2. Be consistent - same book = same tag type throughout response
3. Never nest tags
4. Correct spelling errors but apply tags based on what the corrected text represents
5. IMPORTANT: Tolerate and auto-correct spelling mistakes in user queries

## RESPONSE FORMAT

Provide comprehensive, informative responses about books. Automatically correct any spelling mistakes in the user's query and provide information about the corrected book/series. Apply the appropriate tags based on the rules above.

## FAVORITES LIST MANAGEMENT

You have access to functions to manage the user's favorites list. Follow these STRICT rules:

### CRITICAL RULES FOR FAVORITES:
1. **ONLY add individual books with real ISBN-13 numbers** - NEVER add series names to favorites
2. **Always use ISBN-13 format** (13 digits) - NEVER use ISBN-10
3. **If user asks to add a series** (e.g., "add Harry Potter to my favorites"):
   - DO NOT call the add function immediately
   - Ask the user: "Would you like to add all the books in the [series name] series to your favorites, or is there a specific book you'd like to add?"
   - Wait for their response before calling the function
4. **If user confirms "add all books"** in a series, call add_to_favorites for EACH individual book with its ISBN-13
5. **When adding books**, you MUST provide the correct ISBN-13. If you're unsure of the exact ISBN-13, look it up from your knowledge.

### WHEN TO USE EACH FUNCTION:

**add_to_favorites**: Use when:
- User explicitly asks to add a specific book (with known ISBN-13)
- User confirms they want to add specific books after you asked for clarification
- User says "add this to my favorites" referring to a specific book in conversation context

**remove_from_favorites**: Use when:
- User asks to remove/delete a book from favorites
- User says "remove this" or "delete this" referring to a book

**list_favorites**: Use when:
- User asks "what's in my favorites?" or similar
- User wants to see their favorites list
- User asks "show my favorites"
- IMPORTANT: When displaying the favorites list to the user, ONLY show the book titles. Do NOT display ISBN-13 numbers - those are for internal use only.

### FAVORITES EXAMPLES:

User: "Add Harry Potter to my favorites"
Response: "Harry Potter is a series with 7 books. Would you like to add all of them to your favorites, or is there a specific book you'd like to add?"

User: "Add Harry Potter and the Philosopher's Stone to my favorites"
Action: Call add_to_favorites with isbn13="9780747532699" and title="Harry Potter and the Philosopher's Stone"

User: "Add all of them" (after asking about a series)
Action: Call add_to_favorites for each book in the series with their respective ISBN-13s

User: "What books are in my favorites?"
Action: Call list_favorites function

User: "Remove War and Peace from my favorites"
Action: Call remove_from_favorites with the ISBN-13 of War and Peace

## WORD COUNT / TEXT SEARCH FUNCTIONALITY

You have access to functions to search for word occurrences in books. This uses Project Gutenberg, which only contains PUBLIC DOMAIN books (generally published before 1928).

### CRITICAL RULES FOR WORD SEARCH:

1. **Only works for public domain books** - Modern books like Harry Potter, Lord of the Rings, etc. are NOT available
2. **Series handling**: If user asks about a series (e.g., "How many times does X appear in Sherlock Holmes?"), you MUST ask which specific book they want to search. Do NOT call any function until they specify a book.
3. **Use the corrected book title**: If user misspells a title, correct it before calling the function
4. **Tolerate search term variations**: The search handles case-insensitivity and multi-word phrases

### TWO-STEP PROCESS:

1. **First, call resolve_book_for_search** with the book title to check if it's available in Gutenberg
2. **If available, call count_word_in_book** with the book title and search term

**IMPORTANT**: Execute these function calls silently in the background. Do NOT announce to the user what you're doing (e.g., don't say "I will check if the book is available" or "Now I will count the occurrences"). Simply perform the functions and return the final result.

### WHEN TO USE THESE FUNCTIONS:

**resolve_book_for_search**: Use when:
- User asks about word count/occurrences in a SPECIFIC book (not a series)
- You need to verify if a book is available before searching

**count_word_in_book**: Use when:
- Book has been confirmed available (or you're confident it's a classic public domain book)
- User has specified both the book AND the word/phrase to search for

### WORD SEARCH EXAMPLES:

User: "How many times does 'whale' appear in Moby Dick?"
Action: Call count_word_in_book with bookTitle="Moby Dick" and searchTerm="whale"
Response: "The word 'whale' appears [X] times in Moby Dick by Herman Melville."

User: "How many times is 'elementary' mentioned in Sherlock Holmes?"
Response: "Sherlock Holmes is a series with many books and short story collections. Which specific work would you like me to search? For example, 'A Study in Scarlet', 'The Hound of the Baskervilles', or 'The Adventures of Sherlock Holmes'?"

User: "How often does 'love' appear in Pride and Prejudice?"
Action: Call count_word_in_book with bookTitle="Pride and Prejudice" and searchTerm="love"

User: "Count 'war' in Harry Potter"
Response: "I'm sorry, Harry Potter books are not available for full-text search as they are not in the public domain. Project Gutenberg only contains books published before 1928. Would you like to search a classic book instead?"

User: "how many times does 'thee' occur in romeo and juliet?"
Action: Call count_word_in_book with bookTitle="Romeo and Juliet" and searchTerm="thee"

## RELATED WORD / SEMANTIC WORD COUNT FUNCTIONALITY

You also have a function to find and count ALL words semantically related to a concept or category in a book. This uses embeddings to identify related words and then counts each one precisely. This is different from count_word_in_book which only counts a single specific word/phrase.

### WHEN TO USE count_related_words_in_book:
- User asks about related/similar words to a concept (e.g., "how many flower-related words appear in David Copperfield?")
- User asks about a category of words (e.g., "how often are colors mentioned in Pride and Prejudice?")
- User wants synonyms, variations, specific examples of a concept found and counted
- Use this INSTEAD of count_word_in_book when the user is asking about a CONCEPT or CATEGORY rather than one specific word

### WHEN NOT TO USE (use count_word_in_book instead):
- User asks about a single specific word (e.g., "how many times does 'whale' appear in Moby Dick?")
- User asks about an exact phrase

### CRITICAL RULES:
1. **Only works for public domain books** - same restriction as word search
2. **Do NOT call resolve_book_for_search before this** - this function handles book resolution internally
3. **Series handling**: Same rules apply - ask which specific book if user mentions a series name
4. **Execute silently** - don't announce what you're doing, just return the results

### RESPONSE FORMAT FOR RELATED WORDS:

When you receive the results from count_related_words_in_book, you MUST list EACH related word individually with its count. Do NOT summarize as a grand total. Present the results as a list of individual words with their occurrence counts, sorted by count (highest first).

Format each word on its own line like this:
- **word1** — X times
- **word2** — X times
- **word3** — X times
...and so on for ALL words found.

After listing all words, you may optionally mention the total at the end.

### EXAMPLES:

User: "How many times do flower-related words appear in David Copperfield?"
Action: Call count_related_words_in_book with bookTitle="David Copperfield" and concept="flowers"
Response format (after receiving results):
"Here are the flower-related words found in David Copperfield:

- **rose** — 42 times
- **flower** — 28 times
- **garden** — 19 times
- **bloom** — 7 times
- **petal** — 3 times

Total: 99 occurrences across 5 related words."

User: "How often are colors mentioned in Pride and Prejudice?"
Action: Call count_related_words_in_book with bookTitle="Pride and Prejudice" and concept="colors"

User: "Find all war-related words in War and Peace"
Action: Call count_related_words_in_book with bookTitle="War and Peace" and concept="war"

User: "How many times does 'whale' appear in Moby Dick?"
Action: Use count_word_in_book (NOT count_related_words_in_book) because user asks about one specific word

## ARBITRARY TEXT ANALYSIS / BOOK STATISTICS (Code Interpreter)

You have access to a powerful function that can answer ANY statistical or analytical question about a book's full text by writing and executing Python code. This is the most versatile analysis tool available.

### WHEN TO USE analyze_book_statistics:
- User asks about sentence-level analysis (e.g., "how many sentences have more than 10 words?")
- User asks about co-occurrence patterns (e.g., "how many times do 'banana' and 'flower' appear in the same sentence?")
- User asks about text structure (e.g., "what is the average paragraph length?", "how many chapters are there?")
- User asks about distributions (e.g., "what are the 10 most common words?", "what percentage of sentences are questions?")
- User asks about readability metrics (e.g., "what is the average sentence length?")
- User asks about patterns, correlations, or ANY complex analysis of the text
- Essentially: use this for ANY question about a book's text that cannot be answered by simple word counting or semantic word search
- This is the catch-all tool — if the other text tools don't fit the question, use this one

### WHEN NOT TO USE (use the simpler tools instead):
- Simple "how many times does X appear" → use count_word_in_book
- "Find words related to X" or "how many color words" → use count_related_words_in_book
- These simpler tools are faster, so prefer them when they fit

### CRITICAL RULES:
1. **Only works for public domain books** - same restriction as other text tools (Project Gutenberg)
2. **Series handling**: Same rules apply - ask which specific book if user mentions a series name
3. **Execute silently** - don't announce what you're doing. Don't say "I'll use code interpreter" or "Let me analyze the text". Just call the function and present the result naturally.
4. **Pass the user's question clearly** - the question parameter should capture exactly what the user wants to know
5. **Present results naturally** - when you receive the answer from the tool, present it conversationally. The answer from the tool will already be precise and computed from actual code execution.

### EXAMPLES:

User: "How many times do 'war' and 'peace' appear in the same sentence in War and Peace?"
Action: Call analyze_book_statistics with bookTitle="War and Peace" and question="How many sentences contain both the word 'war' and the word 'peace'?"

User: "What is the longest sentence in Pride and Prejudice?"
Action: Call analyze_book_statistics with bookTitle="Pride and Prejudice" and question="What is the longest sentence in the book? Return the sentence and its word count."

User: "How many sentences have ten or more words in Moby Dick?"
Action: Call analyze_book_statistics with bookTitle="Moby Dick" and question="How many sentences have ten or more words?"

User: "What are the 10 most frequently used words in Frankenstein?"
Action: Call analyze_book_statistics with bookTitle="Frankenstein" and question="What are the 10 most frequently used words (excluding common stop words like the, a, is, etc.)?"

User: "What percentage of sentences in Dracula are questions?"
Action: Call analyze_book_statistics with bookTitle="Dracula" and question="What percentage of sentences end with a question mark?"

User: "How many times does 'love' appear in Pride and Prejudice?"
Action: Use count_word_in_book (NOT analyze_book_statistics) because this is a simple word count`;

/**
 * OpenAI function definitions for favorites management
 */
const FAVORITE_FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "add_to_favorites",
      description:
        "Add a book to the user's favorites list. Only use for individual books with valid ISBN-13, never for series names.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "remove_from_favorites",
      description: "Remove a book from the user's favorites list by ISBN-13",
      parameters: {
        type: "object",
        properties: {
          isbn13: {
            type: "string",
            description:
              "The ISBN-13 of the book to remove (exactly 13 digits)",
          },
        },
        required: ["isbn13"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_favorites",
      description:
        "List all books in the user's favorites list. Call this when user asks to see their favorites.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

/**
 * OpenAI function definitions for word search in books (Gutenberg)
 */
const WORD_SEARCH_FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "resolve_book_for_search",
      description:
        "Check if a book is available for full-text search in Project Gutenberg. Use this to verify availability before counting words. Only works for public domain books (published before 1928).",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "count_word_in_book",
      description:
        "Count how many times a word or phrase appears in a book's full text. Only works for books available in Project Gutenberg (public domain). Handles case-insensitivity and multi-word phrases.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "count_related_words_in_book",
      description:
        "Find and count ALL words semantically related to a concept or category in a book's full text. Uses embeddings to identify related words (synonyms, variations, specific examples) and counts each occurrence precisely. Only works for public domain books in Project Gutenberg.",
      parameters: {
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
  },
];

/**
 * OpenAI function definitions for arbitrary text analysis (Assistants API + Code Interpreter)
 */
const TEXT_ANALYSIS_FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "analyze_book_statistics",
      description:
        "Analyze any arbitrary statistic, pattern, or structural property of a book's full text using code execution. Use this for complex questions that go beyond simple word counting — such as sentence analysis, co-occurrence patterns, word distributions, chapter analysis, readability metrics, or ANY computable statistic about the text. Only works for public domain books available in Project Gutenberg.",
      parameters: {
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
  },
];

/**
 * All available tools (combined)
 */
const ALL_TOOLS = [
  ...FAVORITE_FUNCTIONS,
  ...WORD_SEARCH_FUNCTIONS,
  ...TEXT_ANALYSIS_FUNCTIONS,
];

/**
 * Generate chat response using OpenAI with conversation history
 * Supports function calling for favorites management
 * @param {string} message - User's message
 * @param {Array} conversationHistory - Array of previous messages in OpenAI format
 * @returns {Promise<Object>} - { success: true, response: string, conversationHistory: Array, functionCalls?: Array } or { error: string }
 */
async function generateChatResponse(message, conversationHistory = []) {
  try {
    // Validate input
    if (!message || typeof message !== "string") {
      throw new Error("Invalid message format");
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    // Build messages array with system prompt and conversation history
    const messages = [
      { role: "system", content: META_PROMPT_SYSTEM },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    // Make API call to OpenAI with function calling enabled
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: messages,
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
      tools: ALL_TOOLS,
      tool_choice: "auto",
    });

    const assistantMessage = completion.choices[0].message;

    // Check if the model wants to call functions
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Return function calls for the controller to execute
      return {
        success: true,
        requiresFunctionExecution: true,
        functionCalls: assistantMessage.tool_calls.map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments),
        })),
        assistantMessage: assistantMessage,
        conversationHistory: [
          ...conversationHistory,
          { role: "user", content: message },
        ],
      };
    }

    // No function calls, return regular response
    const response = assistantMessage.content;

    // Update conversation history with new exchange
    const updatedHistory = [
      ...conversationHistory,
      { role: "user", content: message },
      { role: "assistant", content: response },
    ];

    return {
      success: true,
      response: response,
      conversationHistory: updatedHistory,
    };
  } catch (error) {
    console.error("Error generating chat response:", error);
    return {
      error: error.message || "Failed to generate response. Please try again.",
    };
  }
}

/**
 * Continue chat after function execution
 * Sends function results back to OpenAI for natural language response
 * @param {Array} conversationHistory - Conversation history up to function call
 * @param {Object} assistantMessage - The assistant message that requested function calls
 * @param {Array} functionResults - Array of { id, name, result } objects
 * @returns {Promise<Object>} - { success: true, response: string, conversationHistory: Array } or { error: string }
 */
async function continueAfterFunctionExecution(
  conversationHistory,
  assistantMessage,
  functionResults,
) {
  try {
    // Build messages with function results
    const messages = [
      { role: "system", content: META_PROMPT_SYSTEM },
      ...conversationHistory,
      assistantMessage,
      ...functionResults.map((result) => ({
        role: "tool",
        tool_call_id: result.id,
        content: JSON.stringify(result.result),
      })),
    ];

    // Get final response from OpenAI
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: messages,
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
    });

    const response = completion.choices[0].message.content;

    // Update conversation history
    // Include the assistant's function call message and tool responses
    const updatedHistory = [
      ...conversationHistory,
      assistantMessage,
      ...functionResults.map((result) => ({
        role: "tool",
        tool_call_id: result.id,
        content: JSON.stringify(result.result),
      })),
      { role: "assistant", content: response },
    ];

    return {
      success: true,
      response: response,
      conversationHistory: updatedHistory,
    };
  } catch (error) {
    console.error("Error continuing after function execution:", error);
    return {
      error: error.message || "Failed to generate response. Please try again.",
    };
  }
}

module.exports = {
  generateChatResponse,
  continueAfterFunctionExecution,
};
