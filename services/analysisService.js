/**
 * Analysis Service - Handles text analysis and visualization
 * Uses Claude's Code Execution tool for both arbitrary book statistics
 * and interactive visualization generation.
 */

const Anthropic = require("@anthropic-ai/sdk");
const { toFile } = require("@anthropic-ai/sdk");
const config = require("../config/appConfig");
const gutenbergService = require("./gutenbergService");

const anthropic = new Anthropic({
  apiKey: config.claude.apiKey,
});

const CODE_EXECUTION_SYSTEM = `You are a precise text analysis engine. The book's full text has been uploaded as a file into this container.
Find the uploaded file (check ./ and /tmp), write and execute Python code to compute the EXACT answer, then present a concise summary.
Rules: Always use code execution — never estimate or guess. Be precise with counting and analysis. Handle edge cases (encoding, punctuation, whitespace). Process large files efficiently. Print clear, well-formatted results.
ABSOLUTE WORD COUNTING RULE — NO EXCEPTIONS:
When counting or ranking words by frequency, you MUST count every single word from first to last with zero filtering:
- Do NOT exclude, filter, or skip ANY words — not "the", "a", "and", "of", "to", "in", "is", "it", or ANY other word
- Do NOT define, declare, hardcode, or import any stop words list from ANY source (NLTK, spaCy, sklearn, gensim, or any other library)
- Do NOT use any heuristic to decide a word is "too common" or "uninteresting" to count
- Count ALL words exactly as they appear — if "the" is most frequent, report "the" as #1. Raw unfiltered counts only
- Lowercase all words before counting, but never remove any word from the count`;

const VISUALIZATION_SYSTEM = `You are a data visualization expert. You receive PRE-COMPUTED analysis data about a book.
Write and execute Python code that builds a self-contained Plotly.js HTML chart as a Python string and prints it between ---HTML_START--- and ---HTML_END--- markers to stdout — this is the ONLY way the HTML reaches the user.
CRITICAL: Use EXACT data provided — never recompute, modify, or round values. Build HTML as a Python string — do NOT use the plotly Python library. No external dependencies beyond Plotly CDN.
HTML: <!DOCTYPE html>, <meta charset="UTF-8">, Plotly CDN (https://cdn.plot.ly/plotly-2.35.2.min.js), width:100%, height:100vh, autosize:true, body margin:0 padding:0.
DESIGN: bg #f8f7f4, plot #ffffff, font "Inter, system-ui, sans-serif". Single color #4f46e5 for all bars/series. Pie/treemap palette: ["#4f46e5","#7c3aed","#a855f7","#c084fc","#e879f9","#f472b6","#fb7185","#f97316","#facc15","#34d399"]. No per-bar rainbow coloring.
Title: 18px weight 600 #111827 (concise: book title + metric). Subtitle: 12px #6b7280 as annotation. Axes: gridlines #e5e7eb, no y-axis zeroline, labels 12px #6b7280, ticks 13px #374151. Margins: l:60 r:30 t:70 b:60.
Bar: bargap 0.35, corner radius 4 (marker.line.width 0). Legend: only for multiple series (showlegend:false otherwise). NO text labels on bars/slices — hover tooltips only (clean format, show value + percentage where relevant).
CHART TYPES: bar→"bar", pie→"pie" (hover: label+percent+value), line→"scatter" mode:"lines", scatter→"scatter" mode:"markers", heatmap→"heatmap", sankey→"sankey", histogram→"histogram", treemap→"treemap".`;

/**
 * Analyze a book's text for any arbitrary statistic using Claude's Code Execution tool.
 * Fetches the book from Project Gutenberg, passes the text to Claude with code execution,
 * and returns the computed result.
 *
 * @param {string} bookTitle - The title of the book to analyze
 * @param {string} question - The user's question/statistic they want answered
 * @returns {Promise<Object>} - { success, answer?, bookTitle?, authors?, error? }
 */
async function analyzeBookStatistics(bookTitle, question) {
  let uploadedFileId = null;

  try {
    const bookResult = await gutenbergService.getBookFullText(bookTitle);

    if (!bookResult.success) {
      return {
        success: false,
        error: bookResult.error,
        bookTitle: bookTitle,
      };
    }

    // Upload book text via Files API so it goes directly into the code
    // execution container's filesystem — avoids context window limits
    // for very large books (e.g. Bleak House at ~1M characters).
    const uploadedFile = await anthropic.beta.files.upload({
      file: await toFile(
        Buffer.from(bookResult.text, "utf-8"),
        "book.txt",
        { type: "text/plain" },
      ),
      betas: ["files-api-2025-04-14"],
    });
    uploadedFileId = uploadedFile.id;

    const userContent = [
      {
        type: "text",
        text:
          `The full text of "${bookResult.bookTitle}" by ${bookResult.authors.join(", ")} ` +
          `has been uploaded as "book.txt" in this container.\n\n` +
          `Question: ${question}\n\n` +
          `Locate the book.txt file, then write and run Python code to compute the exact answer.`,
      },
      {
        type: "container_upload",
        file_id: uploadedFileId,
      },
    ];

    const messages = [{ role: "user", content: userContent }];

    let response = await anthropic.beta.messages.create({
      model: config.claude.model,
      max_tokens: 16384,
      system: CODE_EXECUTION_SYSTEM,
      messages,
      betas: ["files-api-2025-04-14"],
      tools: [{ type: "code_execution_20250825", name: "code_execution" }],
    });

    let allTextBlocks = [];
    allTextBlocks.push(
      ...response.content.filter((block) => block.type === "text"),
    );

    const MAX_CONTINUATIONS = 5;
    let continuations = 0;

    while (
      response.stop_reason === "pause_turn" &&
      continuations < MAX_CONTINUATIONS
    ) {
      continuations++;

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: "Continue your analysis." });

      const params = {
        model: config.claude.model,
        max_tokens: 16384,
        system: CODE_EXECUTION_SYSTEM,
        messages,
        betas: ["files-api-2025-04-14"],
        tools: [{ type: "code_execution_20250825", name: "code_execution" }],
      };

      if (response.container?.id) {
        params.container = response.container.id;
      }

      response = await anthropic.beta.messages.create(params);

      allTextBlocks.push(
        ...response.content.filter((block) => block.type === "text"),
      );
    }

    const answer = allTextBlocks.map((block) => block.text).join("\n");

    if (!answer.trim()) {
      return {
        success: false,
        error: "Analysis did not produce a result",
        bookTitle: bookResult.bookTitle,
      };
    }

    return {
      success: true,
      answer,
      bookTitle: bookResult.bookTitle,
      authors: bookResult.authors,
    };
  } catch (error) {
    console.error("Error analyzing book statistics:", error);
    return {
      success: false,
      error: error.message || "Failed to analyze book statistics",
      bookTitle: bookTitle,
    };
  } finally {
    // Clean up the uploaded file to avoid storage accumulation
    if (uploadedFileId) {
      try {
        await anthropic.beta.files.delete(uploadedFileId, {
          betas: ["files-api-2025-04-14"],
        });
      } catch (cleanupErr) {
        console.warn(
          "Failed to clean up uploaded book file:",
          cleanupErr.message,
        );
      }
    }
  }
}

/**
 * Extract HTML from a Code Execution response by searching all content blocks.
 * Checks text blocks and code execution output blocks for HTML between markers
 * or as a standalone HTML document.
 *
 * @param {Object} response - Claude API response object
 * @returns {string|null} - Extracted HTML string, or null if not found
 */
function extractHtmlFromResponse(response) {
  const allText = [];

  for (const block of response.content) {
    if (block.type === "text") {
      allText.push(block.text);
    }
    // code_execution_20250825 returns bash_code_execution_tool_result blocks
    // where content is an object with { type, stdout, stderr, return_code }
    if (block.content && typeof block.content === "object" && !Array.isArray(block.content)) {
      if (block.content.stdout) {
        allText.push(block.content.stdout);
      }
      if (block.content.content && Array.isArray(block.content.content)) {
        for (const item of block.content.content) {
          if (item.text) allText.push(item.text);
          if (item.output) allText.push(item.output);
        }
      }
    }
    // Legacy: content as an array of items
    if (block.content && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (typeof item === "string") {
          allText.push(item);
        } else if (item.text) {
          allText.push(item.text);
        } else if (item.output) {
          allText.push(item.output);
        } else if (item.stdout) {
          allText.push(item.stdout);
        }
      }
    }
  }

  const fullText = allText.join("\n");

  // Strategy 1: Explicit markers (most reliable)
  const markerMatch = fullText.match(
    /---HTML_START---([\s\S]*?)---HTML_END---/,
  );
  if (markerMatch) return markerMatch[1].trim();

  // Strategy 2: Raw HTML document
  const htmlMatch = fullText.match(/(<!DOCTYPE html[\s\S]*<\/html>)/i);
  if (htmlMatch) return htmlMatch[1].trim();

  // Strategy 3: HTML inside a markdown code block
  const codeBlockMatch = fullText.match(
    /```(?:html)?\s*\n(<!DOCTYPE[\s\S]*?<\/html>)\s*\n```/i,
  );
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  return null;
}

/**
 * Generate an interactive visualization from pre-computed analysis data.
 * Uses Claude's Code Execution tool to parse the data and generate a
 * self-contained Plotly.js HTML chart.
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
    const messages = [
      {
        role: "user",
        content:
          `Book: "${bookTitle}" by ${authors.join(", ")}\n\n` +
          `Pre-computed analysis data (use these EXACT values — do NOT recompute or change anything):\n${analysisData}\n\n` +
          `Generate an interactive ${chartType} visualization from the above data.\n\n` +
          `Write Python code that:\n` +
          `1. Parses the analysis data above to extract data points\n` +
          `2. Builds a complete, self-contained HTML string with an embedded Plotly.js chart\n` +
          `3. Prints the ENTIRE HTML between ---HTML_START--- and ---HTML_END--- markers`,
      },
    ];

    let response = await anthropic.beta.messages.create({
      model: config.claude.model,
      max_tokens: 16384,
      system: VISUALIZATION_SYSTEM,
      messages,
      betas: ["files-api-2025-04-14"],
      tools: [{ type: "code_execution_20250825", name: "code_execution" }],
    });

    let html = extractHtmlFromResponse(response);

    // Handle continuations if the turn was paused before HTML was produced
    const MAX_CONTINUATIONS = 3;
    let continuations = 0;

    while (
      !html &&
      response.stop_reason === "pause_turn" &&
      continuations < MAX_CONTINUATIONS
    ) {
      continuations++;

      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content:
          "Continue. Print the complete HTML between ---HTML_START--- and ---HTML_END--- markers.",
      });

      const params = {
        model: config.claude.model,
        max_tokens: 16384,
        system: VISUALIZATION_SYSTEM,
        messages,
        betas: ["files-api-2025-04-14"],
        tools: [{ type: "code_execution_20250825", name: "code_execution" }],
      };

      if (response.container?.id) {
        params.container = response.container.id;
      }

      response = await anthropic.beta.messages.create(params);
      html = extractHtmlFromResponse(response);
    }

    if (!html) {
      throw new Error("Code execution did not produce valid HTML visualization");
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

/**
 * Analyze a book's text and generate a visualization in one call.
 * Orchestrates: analyzeBookStatistics → generateVisualization.
 * @param {string} bookTitle - The title of the book
 * @param {string} question - The analysis question
 * @param {string} chartType - The type of chart to create
 * @returns {Promise<Object>} - Result from generateVisualization, or analysis error
 */
async function analyzeAndVisualize(bookTitle, question, chartType) {
  const analysisResult = await analyzeBookStatistics(bookTitle, question);

  if (!analysisResult.success) {
    return analysisResult;
  }

  return generateVisualization(
    analysisResult.answer,
    analysisResult.bookTitle,
    analysisResult.authors,
    chartType,
  );
}

module.exports = {
  analyzeBookStatistics,
  generateVisualization,
  analyzeAndVisualize,
};
