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
4. Return only the final answer in a clear, concise format. Do not explain the code unless asked.

Important:
- The uploaded file is plain text (.txt) of a book from Project Gutenberg.
- The file may contain Gutenberg header/footer metadata — be aware of this but include the full text in analysis unless the user specifically asks about the "story" or "body" only.
- For sentence-related questions, split on common sentence terminators (. ! ?) while handling abbreviations reasonably.
- For word-related questions, handle case-insensitivity by default.
- Always verify your results by running the code — never guess.`;

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
      console.log(
        "Cached assistant no longer exists, creating a new one...",
      );
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
  console.log(`Created new text analysis assistant: ${assistant.id}`);
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
      console.warn("Assistant run completed with incomplete status");
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
    `Assistant run timed out after ${maxAttempts * intervalMs / 1000} seconds`,
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

    // 4. Create a thread with the user's question and the book file attached
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: `The attached file contains the full text of "${bookResult.bookTitle}" by ${bookResult.authors.join(", ")}.\n\nQuestion: ${question}\n\nWrite and execute Python code to answer this precisely.`,
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
        console.error(
          "Failed to clean up uploaded file:",
          cleanupError.message,
        );
      }
    }
  }
}

module.exports = {
  analyzeBookStatistics,
};
