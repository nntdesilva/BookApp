/**
 * Assistant Service - Handles OpenAI Assistants API with Code Interpreter
 * Used for arbitrary text analysis on book full texts from Project Gutenberg.
 * The Assistant writes and executes Python code to answer any statistical
 * question about the book's text.
 */

const OpenAI = require("openai");
const { toFile } = require("openai");
const config = require("../config/appConfig");
const gutenbergService = require("./gutenbergService");

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Cache the assistant ID in memory so we don't recreate it every request
let cachedAssistantId = null;

const ASSISTANT_INSTRUCTIONS = `You are a precise text analysis assistant. You will receive a book's full text as an uploaded file.

Your job:
1. Read the uploaded file contents using Python code.
2. Write and execute Python code to answer the user's question about the text.
3. Always return PRECISE, EXACT results — never estimate or approximate.
4. Return only the final answer in a clear, structured format. Do not explain the code unless asked.

CRITICAL OUTPUT FORMAT FOR WORD FREQUENCY ANALYSIS:
When the question asks for "top N words", "most common words", or any word frequency analysis, you MUST format your output as a simple list where each line contains:
word: count

Example for "top 10 words":
upon: 547
said: 483
one: 456
man: 397
time: 356
mr: 312
like: 289
could: 276
people: 267
two: 265

CRITICAL RULES:
1. Do NOT add numbering, do NOT add explanations, do NOT add markdown formatting. Just word: count on each line.
2. If the question asks for top N words, return EXACTLY N words, no more, no less.
3. To ensure exactly N results, use Python slicing: word_counts.most_common(N) where N is the exact number requested.
4. Example Python code to get EXACTLY 10 words:
   top_words = word_counts.most_common(10)  # Returns exactly 10 tuples
   for word, count in top_words:
       print(f"{word}: {count}")
5. NEVER return more or fewer words than requested. Count your output lines before returning.

MANDATORY WORD COUNTING METHOD:
For ANY analysis involving word frequencies, word counts, "most common words", or any word-level tokenization, you MUST use this EXACT Python pattern:
\`\`\`python
import re
from collections import Counter
words = re.findall(r'\\b[a-z]{2,}\\b', text.lower(), re.ASCII)
word_counts = Counter(words)
\`\`\`
The pattern [a-z]{2,} matches only words with 2 or more characters, filtering out single letters from contractions/possessives (e.g., "s" from "it's", "t" from "don't").
The re.ASCII flag is REQUIRED — without it, Python's \\b uses Unicode word boundaries which differ from how our app counts words elsewhere. This ensures consistent results.
NEVER use text.split(), str.count(), or any other tokenization method for word counting. ONLY use re.findall with the exact pattern above.

MANDATORY STOP WORD HANDLING:
When the analysis requires excluding stop words (e.g., "most common words", "top N words excluding stop words", or any word frequency analysis that should filter out filler words), you MUST:
1. Use NLTK's English stop words: import nltk; nltk.download('stopwords', quiet=True); from nltk.corpus import stopwords; stop_words = set(stopwords.words('english'))
2. ALWAYS use this exact method — never create a custom stop word list, never use any other source of stop words.
3. This ensures identical results every time the same question is asked.

Important:
- The uploaded file is plain text (.txt) of a book from Project Gutenberg.
- The file may contain Gutenberg header/footer metadata — be aware of this but include the full text in analysis unless the user specifically asks about the "story" or "body" only.
- For sentence-related questions, split on common sentence terminators (. ! ?) while handling abbreviations reasonably.
- Always verify your results by running the code — never guess.`;

const VISUALIZATION_INSTRUCTIONS = `You are a data visualization expert. You receive PRE-COMPUTED analysis data and generate interactive HTML charts.

CRITICAL RULES:
1. The data has ALREADY been computed. Do NOT recompute, re-analyze, or modify ANY values.
2. Use the EXACT numbers, words, and data from the provided analysis. Do NOT change, round, or recalculate anything.
3. Your ONLY job is to take the provided data and render it as a Plotly.js chart inside a self-contained HTML page.

DATA PARSING:
When you receive data in the format "word: count" (one per line), parse it exactly as provided:
- Extract the word (label) before the colon
- Extract the count (value) after the colon
- Use the EXACT words as labels in the chart
- Use the EXACT counts as values in the chart
- Maintain the order provided (it's already sorted by frequency)

Example input:
upon: 547
said: 483
one: 456

Should produce labels: ["upon", "said", "one"] and values: [547, 483, 456]

OUTPUT FORMAT:
- Start your response with exactly: ---HTML_START---
- End your response with exactly: ---HTML_END---
- Between these markers, include ONLY the complete HTML document.
- Do NOT include ANY text, explanation, or commentary outside the markers.

HTML REQUIREMENTS:
- Start with <!DOCTYPE html> and end with </html>
- Load Plotly.js from CDN: <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
- Contain ALL data inline in JavaScript variables
- The chart must fill the page: use layout with autosize true, and set the div to width:100%, height:100vh
- Use a clean white background (#ffffff)
- Include a descriptive title showing the book name
- Enable hover tooltips showing word and count
- Use an attractive, modern color palette with distinct colors for each segment
- Ensure the chart is responsive
- No external dependencies other than the Plotly.js CDN
- Add <meta charset="UTF-8"> in the head
- Set body margin to 0
- For pie charts: show both percentage and absolute values in hover text

CHART TYPES:
- "bar chart" → Plotly bar trace
- "pie chart" → Plotly pie trace with textinfo showing both label and percent
- "line chart" → Plotly scatter trace with mode "lines"
- "scatter plot" → Plotly scatter trace with mode "markers"
- "heatmap" → Plotly heatmap trace
- "sankey diagram" → Plotly sankey trace
- "histogram" → Plotly histogram trace
- "treemap" → Plotly treemap trace
- Any other type → choose the most appropriate Plotly trace`;

/**
 * Get or create the persistent text analysis assistant.
 * Creates one on first call, then reuses the cached ID.
 * If the cached assistant no longer exists (deleted externally), recreates it.
 * @returns {Promise<string>} - The assistant ID
 */
async function getOrCreateAssistant() {
  if (cachedAssistantId) {
    try {
      // Verify the cached assistant still exists
      await openai.beta.assistants.retrieve(cachedAssistantId);
      return cachedAssistantId;
    } catch (error) {
      // Assistant was deleted externally, recreate it
      cachedAssistantId = null;
    }
  }

  const assistant = await openai.beta.assistants.create({
    name: "Book Text Analyzer",
    instructions: ASSISTANT_INSTRUCTIONS,
    model: config.assistant.model,
    tools: [{ type: "code_interpreter" }],
  });

  cachedAssistantId = assistant.id;
  return cachedAssistantId;
}

/**
 * Poll a run until it reaches a terminal state (completed, failed, etc.)
 * @param {string} threadId - The thread ID
 * @param {string} runId - The run ID
 * @returns {Promise<Object>} - The completed run object
 * @throws {Error} - If the run fails, is cancelled, expires, or times out
 */
async function pollRunUntilComplete(threadId, runId) {
  const maxAttempts = config.assistant.maxPollAttempts;
  const intervalMs = config.assistant.pollIntervalMs;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);

    if (run.status === "completed") {
      return run;
    }

    if (run.status === "incomplete") {
      // Partial result — still usable, return it
      return run;
    }

    if (["failed", "cancelled", "expired"].includes(run.status)) {
      const errorMsg =
        run.last_error?.message || `Run ${run.status} with no error details`;
      throw new Error(`Assistant run ${run.status}: ${errorMsg}`);
    }

    // Still in progress (queued, in_progress, cancelling) — wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Assistant run timed out after ${(maxAttempts * intervalMs) / 1000} seconds`,
  );
}

/**
 * Analyze a book's text for any arbitrary statistic using the Assistants API
 * with Code Interpreter. Fetches the book from Gutenberg, uploads it,
 * and lets the Assistant write & execute Python to answer the question.
 *
 * @param {string} bookTitle - The title of the book to analyze
 * @param {string} question - The user's question/statistic they want answered
 * @returns {Promise<Object>} - { success, answer?, bookTitle?, authors?, error? }
 */
async function analyzeBookStatistics(bookTitle, question) {
  // 1. Fetch the full book text from Gutenberg
  const bookResult = await gutenbergService.getBookFullText(bookTitle);

  if (!bookResult.success) {
    return {
      success: false,
      error: bookResult.error,
      searchedTitle: bookTitle,
    };
  }

  let uploadedFileId = null;

  try {
    // 2. Get or create the persistent assistant
    const assistantId = await getOrCreateAssistant();

    // 3. Upload the book text as a file to OpenAI
    const sanitizedTitle = bookResult.bookTitle.replace(/[^a-zA-Z0-9 ]/g, "");
    const file = await openai.files.create({
      file: await toFile(
        Buffer.from(bookResult.text, "utf-8"),
        `${sanitizedTitle}.txt`,
      ),
      purpose: "assistants",
    });
    uploadedFileId = file.id;

    // 4. Create a thread with the user's question and the book file attached.
    //    The mandatory Python code is embedded in the message so the
    //    assistant uses it verbatim for any word-level analysis.
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: `The attached file contains the full text of "${bookResult.bookTitle}" by ${bookResult.authors.join(", ")}.\n\n` +
            `Question: ${question}\n\n` +
            `Write and execute Python code to answer this precisely.\n\n` +
            `IMPORTANT — if the question involves word counting, word frequencies, or any word-level tokenization, you MUST use this exact code (do NOT modify):\n` +
            `\`\`\`python\n` +
            `import re\n` +
            `from collections import Counter\n` +
            `words = re.findall(r'\\\\b[a-z]{2,}\\\\b', text.lower(), re.ASCII)\n` +
            `word_counts = Counter(words)\n` +
            `\`\`\`\n` +
            `For stop words use NLTK only: import nltk; nltk.download('stopwords', quiet=True); from nltk.corpus import stopwords; stop_words = set(stopwords.words('english'))`,
          attachments: [
            {
              file_id: file.id,
              tools: [{ type: "code_interpreter" }],
            },
          ],
        },
      ],
    });

    // 5. Create a run (kicks off the assistant's processing)
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    // 6. Poll until the run completes
    await pollRunUntilComplete(thread.id, run.id);

    // 7. Retrieve the assistant's response messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessages = messages.data.filter(
      (m) => m.role === "assistant",
    );

    if (assistantMessages.length === 0) {
      throw new Error("Assistant did not produce a response");
    }

    // Extract text content from the latest assistant message
    const latestMessage = assistantMessages[0];
    const textContent = latestMessage.content
      .filter((block) => block.type === "text")
      .map((block) => block.text.value)
      .join("\n");

    return {
      success: true,
      answer: textContent,
      bookTitle: bookResult.bookTitle,
      authors: bookResult.authors,
    };
  } catch (error) {
    console.error("Error in assistant text analysis:", error);
    return {
      success: false,
      error: error.message || "Failed to analyze book text",
      bookTitle: bookResult.bookTitle,
    };
  } finally {
    // 8. Clean up: delete the uploaded file from OpenAI
    if (uploadedFileId) {
      try {
        await openai.files.del(uploadedFileId);
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded file:", cleanupError.message);
      }
    }
  }
}

/**
 * Generate an interactive visualization from pre-computed analysis data.
 * This function ONLY renders — it does NOT compute anything.
 * Uses a simple chat completion to turn data into a Plotly.js HTML chart.
 *
 * @param {string} analysisData - Pre-computed analysis text from analyzeBookStatistics
 * @param {string} bookTitle - The title of the book (for chart labels)
 * @param {string[]} authors - The book's authors (for chart labels)
 * @param {string} chartType - The type of chart to create (bar, pie, sankey, etc.)
 * @returns {Promise<Object>} - { success, html?, bookTitle?, authors?, error? }
 */
async function generateVisualization(
  analysisData,
  bookTitle,
  authors,
  chartType,
) {
  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: "system", content: VISUALIZATION_INSTRUCTIONS },
        {
          role: "user",
          content:
            `Book: "${bookTitle}" by ${authors.join(", ")}\n\n` +
            `Pre-computed analysis data (use these EXACT numbers — do NOT recompute or change anything):\n${analysisData}\n\n` +
            `Generate an interactive ${chartType} from the above data.\n\n` +
            `Output ONLY the HTML between ---HTML_START--- and ---HTML_END--- markers.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    const textContent = completion.choices[0].message.content;

    // Extract HTML from the response using multiple strategies
    let html;

    // Strategy 1: Look for explicit markers
    const markerMatch = textContent.match(
      /---HTML_START---([\s\S]*?)---HTML_END---/,
    );
    if (markerMatch) {
      html = markerMatch[1].trim();
    } else {
      // Strategy 2: Look for HTML inside markdown code block
      const codeBlockMatch = textContent.match(
        /```(?:html)?\s*\n(<!DOCTYPE[\s\S]*?<\/html>)\s*\n```/i,
      );
      if (codeBlockMatch) {
        html = codeBlockMatch[1].trim();
      } else {
        // Strategy 3: Look for raw HTML document
        const rawMatch = textContent.match(/(<!DOCTYPE html[\s\S]*<\/html>)/i);
        if (rawMatch) {
          html = rawMatch[1].trim();
        } else {
          throw new Error("Did not produce valid HTML visualization");
        }
      }
    }

    return {
      success: true,
      html: html,
      bookTitle: bookTitle,
      authors: authors,
    };
  } catch (error) {
    console.error("Error generating visualization:", error);
    return {
      success: false,
      error: error.message || "Failed to generate visualization",
      bookTitle: bookTitle,
    };
  }
}

module.exports = {
  analyzeBookStatistics,
  generateVisualization,
};
