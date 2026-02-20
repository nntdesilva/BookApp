# Changelog

All notable changes to the BookApp project are documented in the [changelogs](./changelogs/) directory.

## Quick Links

- **[Latest Version: v0.9.6](./changelogs/v0.9.6.md)** - 2026-02-20
- **[Version History](./changelogs/README.md)** - Browse all versions

## Recent Updates

### [v0.9.6](./changelogs/v0.9.6.md) - 2026-02-20

CI/CD: Added continuous deployment pipeline via GitHub Actions. On push to `main`, after all tests pass, the workflow authenticates to GCP via Workload Identity Federation and submits a Cloud Build job that builds the Docker image, pushes it to Artifact Registry, and deploys to Cloud Run in `us-central1`.

### [v0.9.5](./changelogs/v0.9.5.md) - 2026-02-18

Testing: Added live-API integration test suite (`tests/integration.test.js`) with 14 tests across 6 suites. Covers Gutenberg text fetching, word counting, OpenAI embeddings, Claude Code Execution analysis, AI chat tool-call routing, multi-turn memory, and a full end-to-end word count verification that asserts the AI's natural-language response contains the exact computed count.

### [v0.9.4](./changelogs/v0.9.4.md) - 2026-02-18

Testing: Added comprehensive Jest unit test suite covering all services, controllers, middleware, and utilities. 198 tests across 11 test files, all located in the `tests/` directory. Covers happy-path, edge cases, and error/failure scenarios including malformed LLM output, empty responses, and token limit errors. External dependencies (Claude, OpenAI, MongoDB, Gutenberg) are fully mocked.

### [v0.9.3](./changelogs/v0.9.3.md) - 2026-02-17

New Feature: Added AI tool calling support for clearing the entire favourites list in one command. Users can now say "remove all books from my favourites" in chat to clear their list.

### [v0.9.2](./changelogs/v0.9.2.md) - 2026-02-17

Optimization: Condensed `CODE_EXECUTION_SYSTEM` and `VISUALIZATION_SYSTEM` prompts in `analysisService.js` for token efficiency. All behavioral rules, design specs, and constraints are fully preserved — prompts are denser but functionally identical.

### [v0.9.1](./changelogs/v0.9.1.md) - 2026-02-17

Migration: Switched primary AI provider from OpenAI GPT to Claude (Anthropic) across all AI-powered features. OpenAI is retained exclusively for semantic word search embeddings (`text-embedding-3-large`). Includes full rewrite of `aiService.js` and `analysisService.js` (formerly `assistantService.js`) to use the Anthropic SDK and Claude's Code Execution beta tool.

### [v0.9.0](./changelogs/v0.9.0.md) - 2026-02-14

Major Feature: Interactive Data Visualization using Plotly.js. Book analysis results can now be rendered as interactive charts (bar, pie, line, scatter, heatmap, sankey, histogram, treemap) with smart session-based caching that allows switching between chart types without recomputing data.

### [v0.8.0](./changelogs/v0.8.0.md) - 2026-02-13

Major Feature: Arbitrary Book Statistics using OpenAI Assistants API with Code Interpreter. Users can now ask any statistical question about a book's text, and the AI will write and execute Python code to provide precise, exact answers.

### [v0.7.2](./changelogs/v0.7.2.md) - 2026-02-08

New Feature: Related Word Count functionality using semantic embeddings to find word occurrences in contextually related books.

### [v0.7.1](./changelogs/v0.7.1.md) - 2026-02-08

Bug Fix: Eliminated intermediary AI response step for word count queries. AI now executes functions silently and returns direct results.

### [v0.7.0](./changelogs/v0.7.0.md) - 2026-02-07

Major Feature: Word Count in Books using Project Gutenberg integration with AI-powered query interpretation and Gutendex API search.

### [v0.6.1](./changelogs/v0.6.1.md) - 2026-02-04

Major Update: MongoDB storage integration and user authentication with Passport.js for favorites list feature.

### [v0.6.0](./changelogs/v0.6.0.md) - 2026-02-03

Major Feature: Favorites List Management with AI-powered CRUD operations, ISBN-13 validation, and session-based storage.

### [v0.5.0](./changelogs/v0.5.0.md) - 2026-02-02

Major Refactor: Agentic architecture implementation with meta-prompt system and removal of colored badge detector.

### [v0.4.1](./changelogs/v0.4.1.md) - 2026-01-30

Bug Fix: Corrected badge color assignment by preserving search intent (series vs. standalone) in title correction logic.

### [v0.4.0](./changelogs/v0.4.0.md) - 2026-01-28

Major Feature: Intelligent Colored Badge System with series query detection and comprehensive unit testing.

### [v0.3.2](./changelogs/v0.3.2.md) - 2026-01-26

Fixed standalone book title badging consistency and series name search issues.

### [v0.3.1](./changelogs/v0.3.1.md) - 2026-01-25

Intelligent title identification using AI workflows and badge accuracy improvements.

### [v0.3.0](./changelogs/v0.3.0.md) - 2026-01-25

Major Feature: Book Name Text Badges - automatic highlighting system.

### [v0.2.0](./changelogs/v0.2.0.md) - 2026-01-24

Major Feature: Multi-Turn Chat Interaction with session management.

### [v0.1.0](./changelogs/v0.1.0.md) - 2026-01-22

Initial Release - AI-powered book search application.

---

_For detailed information about each version, see the [changelogs directory](./changelogs/)._
