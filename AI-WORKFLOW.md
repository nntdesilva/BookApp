# AI Workflow — Sequence Diagrams

This document walks through how AI works in this app, from the moment a user sends a
message to the moment a response arrives back in the browser. All diagrams use the
actual service names, port numbers, and code paths in this repository.

---

## 1. Overview: How the Agentic Loop Works

The core idea: **Claude is not just answering questions — it is also deciding which tools
to call and when.** The chat-service drives a loop: ask Claude → if Claude wants a tool →
execute it → feed the result back to Claude → repeat until Claude produces plain text.

```mermaid
sequenceDiagram
    autonumber

    participant Browser
    participant GW   as Gateway :3000<br/>(gateway/app.js)
    participant Chat as Chat-service :3005<br/>(chatRoutes.js)
    participant Redis
    participant Claude as Claude API<br/>(aiService.js)

    Browser->>GW: POST /chat  { message }  +cookie(JWT)
    Note over GW: requireAuth middleware decodes JWT<br/>→ sets req.user._id

    GW->>Chat: POST /api/chat<br/>headers: x-user-id, x-username

    Chat->>Redis: GET conv:{userId}
    Redis-->>Chat: [ ...conversation history ]

    Chat->>Claude: messages.create()<br/>system prompt + ALL_TOOLS + history + new message

    alt Claude answers directly (no tools needed)
        Claude-->>Chat: stop_reason: "end_turn"<br/>content: [{ type:"text", text:"..." }]
        Note over Chat: tagService.convertTagsToHTML(response)
        Chat->>Redis: SET conv:{userId}  ← updated history (trimmed to maxHistoryMessages)
        Chat-->>GW: { success:true, response: "<html>..." }
        GW-->>Browser: JSON response

    else Claude wants to call one or more tools
        Claude-->>Chat: stop_reason: "tool_use"<br/>content: [{ type:"tool_use", name:"...", input:{...} }]

        loop Up to 10 tool rounds (MAX_TOOL_ROUNDS)
            Note over Chat: executeFunction() dispatches each tool call<br/>to the appropriate client
            Chat->>Chat: await Promise.all(functionCalls.map → executeFunction)
            Note over Chat: tool results collected

            Chat->>Claude: messages.create()<br/>assistant turn (tool_use blocks) +<br/>user turn (tool_result blocks)

            alt Claude wants more tools
                Claude-->>Chat: stop_reason: "tool_use" again
            else Claude is done
                Claude-->>Chat: stop_reason: "end_turn"<br/>content: [{ type:"text" }]
            end
        end

        Note over Chat: tagService.convertTagsToHTML(response)
        Chat->>Redis: SET conv:{userId}  ← updated + trimmed history
        Chat-->>GW: { success:true, response:"<html>...", visualization?:html }
        GW-->>Browser: JSON response
    end
```

---

## 2. Favorites Tools (add / list / remove / clear)

These are the simplest tools — one round of tool use, one HTTP call, done.
Claude calls them when the user asks to manage their reading list.

```mermaid
sequenceDiagram
    autonumber

    participant Chat  as Chat-service :3005<br/>(chatRoutes.js)
    participant FC    as favoritesClient.js
    participant Fav   as Favorites-service :3002<br/>(favoritesRoutes.js)
    participant Mongo as MongoDB<br/>bookapp_favorites

    Note over Chat: Claude returned tool_use:<br/>add_to_favorites / remove_from_favorites /<br/>list_favorites / remove_all_favorites

    Chat->>FC: addFavorite(userId, isbn13, title)<br/>— or removeFavorite / listFavorites / clearFavorites

    alt add_to_favorites
        FC->>Fav: POST /api/favorites<br/>headers: x-user-id<br/>body: { isbn13, title }
        Fav->>Fav: isValidIsbn13() + normalizeIsbn13()
        Fav->>Mongo: Favorite.findOne({ userId, isbn })  ← duplicate check
        Mongo-->>Fav: null (not found)
        Fav->>Mongo: Favorite.create({ userId, isbn, title })
        Mongo-->>Fav: saved document
        Fav-->>FC: { success:true, message:"Added..." }

    else remove_from_favorites
        FC->>Fav: DELETE /api/favorites/:isbn<br/>headers: x-user-id
        Fav->>Mongo: Favorite.findOneAndDelete({ userId, isbn })
        Mongo-->>Fav: removed document (or null)
        Fav-->>FC: { success:true, message:"Removed..." }

    else list_favorites
        FC->>Fav: GET /api/favorites<br/>headers: x-user-id
        Fav->>Mongo: Favorite.find({ userId }).sort({ addedAt:-1 })
        Mongo-->>Fav: [ ...favorites ]
        Fav-->>FC: { success:true, favorites:[...], count:N }

    else remove_all_favorites
        FC->>Fav: DELETE /api/favorites<br/>headers: x-user-id
        Fav->>Mongo: Favorite.deleteMany({ userId })
        Mongo-->>Fav: { deletedCount: N }
        Fav-->>FC: { success:true, message:"Cleared N books..." }
    end

    FC-->>Chat: tool result object
    Note over Chat: result fed back to Claude<br/>as a tool_result block →<br/>Claude writes the final reply
```

---

## 3. Word Search Tools (resolve + count / semantic search)

Used when a user asks "how many times does 'love' appear in Pride and Prejudice?"
Claude first resolves the book to confirm it is on Project Gutenberg, then counts.

```mermaid
sequenceDiagram
    autonumber

    participant Chat  as Chat-service :3005<br/>(chatRoutes.js)
    participant BC    as booksClient.js
    participant Books as Books-service :3003<br/>(booksRoutes.js)
    participant GS    as gutenbergService.js
    participant Guten as Project Gutenberg API<br/>(gutendex.com)
    participant OAI   as OpenAI API<br/>(text-embedding-3-large)

    Note over Chat: Claude calls resolve_book_for_search first<br/>(to verify public-domain availability)

    Chat->>BC: resolveBookForSearch("Pride and Prejudice")
    BC->>Books: POST /api/books/resolve  { bookTitle }
    Books->>GS: resolveBookForSearch(bookTitle)
    GS->>Guten: GET /books?search=Pride+and+Prejudice
    Guten-->>GS: book metadata + text download URL
    GS-->>Books: { available:true, bookTitle, authors, gutenbergId }
    Books-->>BC: same result
    BC-->>Chat: tool result → back to Claude

    Note over Chat: Claude now calls count_word_in_book

    Chat->>BC: countWordInBook("Pride and Prejudice", "love")
    BC->>Books: POST /api/books/count-word  { bookTitle, searchTerm }
    Books->>GS: countWordInBook(bookTitle, searchTerm)
    GS->>Guten: GET plain text of book
    Guten-->>GS: full book text (~700 KB)
    GS->>GS: case-insensitive regex count
    GS-->>Books: { success:true, count:N, searchTerm, bookTitle }
    Books-->>BC: same result
    BC-->>Chat: tool result → back to Claude

    Note over Chat,OAI: For semantic search (count_related_words_in_book)<br/>the flow diverges here ↓

    Chat->>BC: countRelatedWordsInBook("Pride and Prejudice", "emotions")
    BC->>Books: POST /api/books/count-related  { bookTitle, concept }
    Books->>GS: countRelatedWordsInBook(bookTitle, concept)
    GS->>Guten: GET plain text of book
    Guten-->>GS: full book text
    GS->>OAI: embeddings.create({ input: concept })
    OAI-->>GS: concept embedding vector
    GS->>GS: embed every unique word in text<br/>cosine similarity filter (threshold ~0.48)<br/>count each matched word
    GS-->>Books: { success:true, results:[{ word, count },...] }
    Books-->>BC: same result
    BC-->>Chat: tool result → back to Claude
```

---

## 4. Book Statistics Analysis (analyze_book_statistics)

This is the most complex tool. Claude (inside analysis-service) uses the
**Code Execution** beta tool — it literally writes and runs Python code
against the full book text to compute exact statistics.

```mermaid
sequenceDiagram
    autonumber

    participant Chat    as Chat-service :3005<br/>(chatRoutes.js)
    participant AC      as analysisClient.js
    participant Anal    as Analysis-service :3004<br/>(analysisRoutes.js)
    participant AS      as analysisService.js
    participant Books   as Books-service :3003
    participant Guten   as Project Gutenberg
    participant FilesAPI as Anthropic Files API<br/>(beta)
    participant CodeClaude as Claude Code Execution<br/>(beta, analysisService.js)

    Note over Chat: Claude calls analyze_book_statistics<br/>{ bookTitle, question }

    Chat->>AC: analyzeBookStatistics(bookTitle, question)
    AC->>Anal: POST /api/analysis/analyze  { bookTitle, question }

    Note over Anal: Optional Redis cache check (viz cache key)<br/>Cache miss → proceed to analysis

    Anal->>AS: analyzeBookStatistics(bookTitle, question)

    AS->>Books: POST /api/books/text  { bookTitle }
    Books->>Guten: GET plain text
    Guten-->>Books: full book text
    Books-->>AS: { success:true, text, bookTitle, authors }

    AS->>FilesAPI: beta.files.upload(book.txt)<br/>betas: ["files-api-2025-04-14"]
    FilesAPI-->>AS: { id: "file_abc123" }
    Note over AS: Upload avoids passing giant text<br/>inside the context window

    AS->>CodeClaude: beta.messages.create()<br/>tools:[{ type:"code_execution_20250825" }]<br/>user content: [text prompt + container_upload(file_id)]

    loop pause_turn continuations (up to 5)
        CodeClaude-->>AS: stop_reason:"pause_turn"<br/>content: [code + output blocks]
        Note over AS: Claude paused mid-computation<br/>(e.g. large file processing)
        AS->>CodeClaude: messages.create()<br/>{ role:"user", content:"Continue your analysis." }<br/>container: same container id
    end

    CodeClaude-->>AS: stop_reason:"end_turn"<br/>content: [{ type:"text", text:"The word 'love' appears 91 times..." }]

    AS->>FilesAPI: beta.files.delete(file_id)  ← cleanup
    FilesAPI-->>AS: deleted

    AS-->>Anal: { success:true, answer, bookTitle, authors }
    Anal-->>AC: same result
    AC-->>Chat: tool result → fed back to Claude (chat-service)
    Note over Chat: Chat-service Claude reads the computed answer<br/>and writes the final human reply
```

---

## 5. Visualization Generation (generate_visualization)

When a user asks to "chart" or "visualize" data, Claude calls `generate_visualization`.
This triggers a **two-phase** pipeline inside analysis-service: first analyze → then render.

```mermaid
sequenceDiagram
    autonumber

    participant Chat      as Chat-service :3005<br/>(chatRoutes.js)
    participant AC        as analysisClient.js
    participant Anal      as Analysis-service :3004<br/>(analysisRoutes.js → visualize endpoint)
    participant AS        as analysisService.js
    participant Books     as Books-service :3003
    participant Guten     as Project Gutenberg
    participant FilesAPI  as Anthropic Files API
    participant CodeClaude as Claude Code Execution<br/>(two separate calls)

    Note over Chat: Claude calls generate_visualization<br/>{ bookTitle, question, chartType }

    Chat->>AC: generateVisualization(bookTitle, question, chartType)
    AC->>Anal: POST /api/analysis/visualize  { bookTitle, question, chartType }

    Note over Anal: Check Redis cache  key: "viz:{title}::{question}"
    alt Cache hit
        Anal-->>Anal: skip Phase 1, use cached analysis
    else Cache miss — Phase 1: Analyze
        Anal->>AS: analyzeBookStatistics(bookTitle, question)
        AS->>Books: POST /api/books/text
        Books->>Guten: GET plain text
        Guten-->>Books: full text
        Books-->>AS: { text, bookTitle, authors }
        AS->>FilesAPI: upload book.txt
        FilesAPI-->>AS: file_id
        AS->>CodeClaude: messages.create() — CODE EXECUTION SYSTEM<br/>Python code to compute stats
        CodeClaude-->>AS: computed answer text
        AS->>FilesAPI: delete file_id
        Anal->>Anal: redis.set(cacheKey, analysisResult, EX 3600)
    end

    Note over Anal,CodeClaude: Phase 2: Visualize (uses the computed data, NOT the raw book)

    Anal->>AS: generateVisualization(analysisData, bookTitle, authors, chartType)
    AS->>CodeClaude: messages.create() — VISUALIZATION SYSTEM<br/>Python code to build Plotly.js HTML string<br/>prints between ---HTML_START--- and ---HTML_END---

    loop pause_turn continuations (up to 3)
        CodeClaude-->>AS: stop_reason:"pause_turn"
        AS->>CodeClaude: "Continue. Print HTML between markers."
    end

    CodeClaude-->>AS: HTML between markers
    AS->>AS: extractHtmlFromResponse()<br/>parse markers → raw HTML string

    AS-->>Anal: { success:true, html:"<!DOCTYPE html>..." }
    Anal-->>AC: same result
    AC-->>Chat: tool result

    Note over Chat: chatRoutes.js detects generate_visualization result<br/>strips html from tool result before feeding back to Claude<br/>sends sanitized message: "Visualization generated and will be displayed"

    Chat->>Chat: sanitize: visualizationHtml = fr.result.html<br/>replace with short confirmation message for Claude
    Note over Chat: Claude writes a brief text description of the chart

    Chat-->>Chat: responsePayload.visualization = visualizationHtml
    Note over Chat: Response includes BOTH:<br/>response (Claude's text) + visualization (raw HTML)
```

---

## 6. How Identity Flows (x-user-id Header Chain)

No service except the gateway ever reads a JWT cookie. Identity travels as a plain
`x-user-id` header on every internal HTTP call.

```mermaid
sequenceDiagram
    autonumber

    participant Browser
    participant GW    as Gateway :3000<br/>middleware/auth.js
    participant Chat  as Chat-service :3005
    participant Fav   as Favorites-service :3002

    Browser->>GW: Any request + Cookie: token=<JWT>

    Note over GW: jwt.verify(cookie, JWT_SECRET)<br/>→ { userId, username }
    Note over GW: req.user = { _id: userId, username }

    GW->>Chat: x-user-id: <userId><br/>x-username: <username>

    Note over Chat: reads x-user-id from headers<br/>uses it as Redis key: "conv:{userId}"<br/>passes it to all client calls

    Chat->>Fav: x-user-id: <userId>
    Note over Fav: reads x-user-id<br/>uses it as MongoDB filter { userId }
    Note over Fav: NO JWT validation — trusted internal network only
```

---

## Summary: Which Service Uses Which AI / External API

| Service | AI / External API | Purpose |
|---|---|---|
| `chat-service` | Claude (conversational, `messages.create`) | Main chat, tool orchestration |
| `analysis-service` | Claude Code Execution beta (`code_execution_20250825`) | Run Python against full book text |
| `analysis-service` | Anthropic Files API beta | Upload book text into code execution container |
| `books-service` | OpenAI `text-embedding-3-large` | Semantic word similarity (count_related_words) |
| `books-service` | Project Gutenberg (`gutendex.com`) | Download public-domain book text |
| `chat-service` | Redis | Store conversation history per user (TTL 24h) |
| `analysis-service` | Redis | Cache visualization analysis results (TTL 1h) |
