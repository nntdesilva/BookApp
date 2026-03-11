const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
require("dotenv").config();

const FAVORITES_URL = process.env.FAVORITES_SERVICE_URL || "http://localhost:3002";
const BOOKS_URL = process.env.BOOKS_SERVICE_URL || "http://localhost:3003";
const ANALYSIS_URL = process.env.ANALYSIS_SERVICE_URL || "http://localhost:3004";
const MCP_USER_ID = process.env.MCP_USER_ID || "";

async function callService(baseUrl, path, body = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": MCP_USER_ID,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function callServiceGet(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "x-user-id": MCP_USER_ID },
  });
  return res.json();
}

async function callServiceDelete(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: { "x-user-id": MCP_USER_ID },
  });
  return res.json();
}

function registerTools(server) {
  server.tool(
    "add_to_favorites",
    "Add a book to the user's favorites list.",
    {
      isbn13: z.string().describe("The ISBN-13 of the book (exactly 13 digits, no hyphens)."),
      title: z.string().describe("The full title of the book"),
    },
    async ({ isbn13, title }) => {
      const result = await callService(FAVORITES_URL, "/api/favorites", { isbn13, title });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "remove_from_favorites",
    "Remove a book from the user's favorites list by ISBN-13.",
    {
      isbn13: z.string().describe("The ISBN-13 of the book to remove (exactly 13 digits)"),
    },
    async ({ isbn13 }) => {
      const clean = isbn13.replace(/[-\s]/g, "");
      const result = await callServiceDelete(FAVORITES_URL, `/api/favorites/${clean}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "list_favorites",
    "List all books in the user's favorites list.",
    {},
    async () => {
      const result = await callServiceGet(FAVORITES_URL, "/api/favorites");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "remove_all_favorites",
    "Remove ALL books from the user's favorites list.",
    {},
    async () => {
      const result = await callServiceDelete(FAVORITES_URL, "/api/favorites");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "resolve_book_for_search",
    "Check if a book is available for full-text search in Project Gutenberg.",
    {
      bookTitle: z.string().describe("The title of the book to search for"),
    },
    async ({ bookTitle }) => {
      const result = await callService(BOOKS_URL, "/api/books/resolve", { bookTitle });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "count_word_in_book",
    "Count how many times a word or phrase appears in a book's full text.",
    {
      bookTitle: z.string().describe("The title of the book to search in"),
      searchTerm: z.string().describe("The word or phrase to count occurrences of"),
    },
    async ({ bookTitle, searchTerm }) => {
      const result = await callService(BOOKS_URL, "/api/books/count-word", { bookTitle, searchTerm });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "count_related_words_in_book",
    "Find and count ALL words semantically related to a concept in a book's full text.",
    {
      bookTitle: z.string().describe("The title of the book to search in"),
      concept: z.string().describe("The concept or category to find related words for"),
    },
    async ({ bookTitle, concept }) => {
      const result = await callService(BOOKS_URL, "/api/books/count-related", { bookTitle, concept });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "analyze_book_statistics",
    "Analyze any statistic, pattern, or structural property of a book's full text using code execution.",
    {
      bookTitle: z.string().describe("The title of the book to analyze"),
      question: z.string().describe("The question or statistic about the book's text"),
    },
    async ({ bookTitle, question }) => {
      const result = await callService(ANALYSIS_URL, "/api/analysis/analyze", { bookTitle, question });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "generate_visualization",
    "Generate an interactive visualization of book text analysis results.",
    {
      bookTitle: z.string().describe("The title of the book to visualize"),
      question: z.string().describe("What data to compute and visualize"),
      chartType: z.string().describe("The type of chart to create"),
    },
    async ({ bookTitle, question, chartType }) => {
      const result = await callService(ANALYSIS_URL, "/api/analysis/visualize", { bookTitle, question, chartType });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}

async function startStdio() {
  const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
  console.log = (...args) => console.error(...args);
  const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
  console.error("[mcp-server] ── startup config (stdio) ──────────────────────────");
  console.error(`[mcp-server] MCP_TRANSPORT          : set → stdio`);
  console.error(`[mcp-server] MCP_USER_ID            : ${e("MCP_USER_ID")} → ${MCP_USER_ID || "(empty)"}`);
  console.error(`[mcp-server] FAVORITES_SERVICE_URL  : ${e("FAVORITES_SERVICE_URL")} → ${FAVORITES_URL}`);
  console.error(`[mcp-server] BOOKS_SERVICE_URL      : ${e("BOOKS_SERVICE_URL")} → ${BOOKS_URL}`);
  console.error(`[mcp-server] ANALYSIS_SERVICE_URL   : ${e("ANALYSIS_SERVICE_URL")} → ${ANALYSIS_URL}`);
  console.error("[mcp-server] ─────────────────────────────────────────────────────");
  if (!process.env.MCP_USER_ID) console.error("[mcp-server] WARNING: MCP_USER_ID not set — all tool calls will have no user identity");
  const server = new McpServer({ name: "book-app-tools", version: "2.0.0" });
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-server] stdio transport connected and ready`);
}

async function startHttp() {
  const express = require("express");
  const crypto = require("crypto");
  const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

  const PORT = process.env.MCP_PORT || 3006;
  const API_KEY = process.env.MCP_API_KEY;
  const sessions = new Map();

  function authMiddleware(req, res, next) {
    if (!API_KEY) return next();
    const header = req.headers.authorization;
    if (!header || header !== `Bearer ${API_KEY}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "mcp-server" });
  });

  app.all("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];

    if (req.method === "GET" || req.method === "DELETE") {
      if (sessionId && sessions.has(sessionId)) {
        return sessions.get(sessionId).transport.handleRequest(req, res);
      }
      if (req.method === "DELETE") return res.status(404).json({ error: "Session not found" });
    }

    if (req.method === "POST") {
      if (sessionId && sessions.has(sessionId)) {
        return sessions.get(sessionId).transport.handleRequest(req, res, req.body);
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });

      const mcpServer = new McpServer({ name: "book-app-tools", version: "2.0.0" });
      registerTools(mcpServer);

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
        mcpServer.close().catch(() => {});
      };

      await mcpServer.connect(transport);
      if (transport.sessionId) sessions.set(transport.sessionId, { transport, mcpServer });
      return transport.handleRequest(req, res, req.body);
    }

    res.status(405).json({ error: "Method not allowed" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    console.log("[mcp-server] ── startup config (http) ──────────────────────────");
    console.log(`[mcp-server] MCP_TRANSPORT          : set → http`);
    console.log(`[mcp-server] MCP_PORT               : ${e("MCP_PORT")} → ${PORT}`);
    console.log(`[mcp-server] MCP_API_KEY            : ${e("MCP_API_KEY")} (auth enabled=${!!API_KEY})`);
    console.log(`[mcp-server] MCP_USER_ID            : ${e("MCP_USER_ID")} → ${MCP_USER_ID || "(empty)"}`);
    console.log(`[mcp-server] FAVORITES_SERVICE_URL  : ${e("FAVORITES_SERVICE_URL")} → ${FAVORITES_URL}`);
    console.log(`[mcp-server] BOOKS_SERVICE_URL      : ${e("BOOKS_SERVICE_URL")} → ${BOOKS_URL}`);
    console.log(`[mcp-server] ANALYSIS_SERVICE_URL   : ${e("ANALYSIS_SERVICE_URL")} → ${ANALYSIS_URL}`);
    console.log("[mcp-server] ─────────────────────────────────────────────────────");
    if (!process.env.MCP_USER_ID) console.warn("[mcp-server] WARNING: MCP_USER_ID not set — all tool calls will have no user identity");
  });
}

async function main() {
  const mode = process.env.MCP_TRANSPORT || "stdio";
  if (mode === "http") {
    await startHttp();
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  console.error("Fatal: MCP server failed to start:", err);
  process.exit(1);
});
