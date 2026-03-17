# Changelog

All notable changes to the BookApp project are documented in the [changelogs](./changelogs/) directory.

## Quick Links

- **[Latest Version: v0.11.8](./changelogs/v0.11.8.md)** - 2026-03-17
- **[v0.11.6](./changelogs/v0.11.6.md)** - 2026-03-12
- **[v0.11.5](./changelogs/v0.11.5.md)** - 2026-03-11
- **[v0.11.4](./changelogs/v0.11.4.md)** - 2026-03-11
- **[v0.11.3](./changelogs/v0.11.3.md)** - 2026-03-11
- **[v0.11.2](./changelogs/v0.11.2.md)** - 2026-03-11
- **[v0.11.1](./changelogs/v0.11.1.md)** - 2026-03-04
- **[Version History](./changelogs/README.md)** - Browse all versions

## Recent Updates |

### [v0.11.8](./changelogs/v0.11.8.md) - 2026-03-17

Bug Fix: Restricted AI word search tools (`resolve_book_for_search`, `count_word_in_book`) to explicit word-count requests only. The AI no longer invokes these tools for general book questions (plot, author, themes, etc.), reducing unnecessary Gutenberg API calls.

### [v0.11.7](./changelogs/v0.11.7.md) - 2026-03-15

Bug Fix: Fixed errors related to smart badging across the application.

### [v0.11.6](./changelogs/v0.11.6.md) - 2026-03-12

Chore: Replaced all `console.log/warn/error` calls across all six services (gateway, auth-service, favorites-service, chat-service, books-service, analysis-service) with [pino](https://getpino.io/) structured JSON logging. Each service has a `config/logger.js` that outputs plain newline-delimited JSON in production (one queryable object per log line) and colorized human-readable output via `pino-pretty` in development. Every module creates a child logger with a `component` field so logs can be filtered by both `service` and `component` in CloudWatch Logs Insights. Error objects are serialized automatically with `type`, `message`, and `stack`. All 27 source files updated; `pino` and `pino-pretty` added as dependencies in all six `package.json` files.

### [v0.11.5](./changelogs/v0.11.5.md) - 2026-03-11

Bug Fix: Added targeted diagnostic logging to `gateway/middleware/auth.js` and `gateway/app.js` to identify why a successful login (status=200 from the auth-service) was redirecting users back to `/login`. `verifyToken` now logs whether the `token` cookie is present and, if `jwt.verify` fails, logs the error name, message, and secret length so a JWT secret mismatch between services is immediately visible in CloudWatch. `requireAuth` and `redirectIfAuth` log every redirect decision. The login and signup handlers log cookie options at the moment `Set-Cookie` is written. `GET /` logs which cookie names the browser sent on the post-login redirect, revealing whether the cookie arrived at all.

### [v0.11.4](./changelogs/v0.11.4.md) - 2026-03-11

Bug Fix: Fixed all services returning runtime errors in production due to missing environment variables on AWS App Runner. The CD pipeline was deploying every service with an `ImageConfiguration` that only set the `Port`, so secrets were never injected into running containers. Added `RuntimeEnvironmentVariables` to the `update-service` call for all seven services, and updated each service's "Verify required secrets" step to fail fast if a secret is absent. Variables added: `JWT_SECRET` (gateway, auth, favorites), `OPENAI_EMBEDDINGS_API_KEY` (books), `ANTHROPIC_API_KEY` + `REDIS_URL` + `BOOKS_SERVICE_URL` (analysis), `ANTHROPIC_API_KEY` + `REDIS_URL` + `FAVORITES_SERVICE_URL` + `BOOKS_SERVICE_URL` + `ANALYSIS_SERVICE_URL` (chat), `FAVORITES_SERVICE_URL` + `BOOKS_SERVICE_URL` + `ANALYSIS_SERVICE_URL` (mcp), and all inter-service URLs for gateway.

### [v0.11.3](./changelogs/v0.11.3.md) - 2026-03-11

Bug Fix: Fixed login and signup failures on AWS App Runner caused by missing `MONGODB_URI` environment variable on the auth and favorites services. Without it both services fell back to `localhost:27017`, hitting a Mongoose 10-second buffering timeout on every database operation. Set `MONGODB_URI` and `NODE_ENV=production` directly on both App Runner services, added `MONGODB_URI` as a GitHub Actions secret, and updated the CD workflow to pass `RuntimeEnvironmentVariables` in the `deploy-auth` and `deploy-favorites` steps so the env vars are never wiped on future deployments. Removed `AI-WORKFLOW.md`.

### [v0.11.2](./changelogs/v0.11.2.md) - 2026-03-11

Bug Fix: Added detailed debug logging to the gateway login and signup routes to diagnose auth failures in AWS App Runner. Each login/signup attempt now logs the target auth-service URL, fetch-level errors with cause, response parse errors, and the HTTP status/success from the auth service. All service URLs are also logged at startup so misconfigured env vars are immediately visible in CloudWatch.

Bug Fix: Fixed login and signup failures caused by a trailing space in the `AUTH_SERVICE_URL` environment variable on AWS App Runner. Added `.trim()` to all service URL reads in `gateway/config/appConfig.js`, `chat-service/config/appConfig.js`, and `analysis-service/config/appConfig.js` to guard against whitespace in env vars. Also corrected missing inter-service URLs on App Runner: gateway was missing `CHAT_SERVICE_URL` and `FAVORITES_SERVICE_URL`; chat-service was missing `FAVORITES_SERVICE_URL`, `BOOKS_SERVICE_URL`, and `ANALYSIS_SERVICE_URL`; analysis-service was missing `BOOKS_SERVICE_URL`. All services were falling back to localhost defaults in production. Updated all three App Runner services directly.

### [Unreleased] - 2026-03-10

CI: Added a GitHub Actions workflow (`changelog-check.yml`) that runs on every PR to `main` and fails if `CHANGELOG.md` was not modified. Configured as a required status check in branch protection so the merge button is blocked until the changelog is updated.

### [v0.11.1](./changelogs/v0.11.1.md) - 2026-03-04

Testing: Migrated all unit tests from the monolith `tests/` directory into each microservice's own `tests/` folder. Rewrote tests that depended on the old architecture (Passport sessions, embedded `User.favorites`, direct Gutenberg calls in analysisService). Added e2e integration tests in `e2e/` that import service modules directly and use real API keys. Rewrote CI to run only the tests relevant to changed services per PR using `dorny/paths-filter`, with an `all-tests-pass` gate job as the required branch protection check.

### [v0.11.0](./changelogs/v0.11.0.md) - 2026-03-04

Architecture: Decomposed the Express.js monolith into seven independently deployable microservices (gateway, auth-service, favorites-service, books-service, analysis-service, chat-service, mcp-server). Authentication migrated from Passport.js sessions to JWT tokens with Redis-backed conversation state. The `User.favorites` sub-document was extracted into a standalone `Favorite` collection. All services are orchestrated via Docker Compose with shared MongoDB and Redis infrastructure.

### [v0.10.2](./changelogs/v0.10.2.md) - 2026-02-26

New Feature: Dark Mode. A persistent pill-shaped toggle switch fixed in the top-right corner of every page lets users switch between light and dark themes. Logged-in users have their preference saved to MongoDB; guests use `localStorage`. All CSS colors were refactored to CSS custom properties with a full `[data-theme="dark"]` override set. No flash of wrong theme on load.

### [v0.10.1](./changelogs/v0.10.1.md) - 2026-02-26

MCP for Claude Code + AWS Deployment: Added Streamable HTTP transport to the MCP server and deployed it to AWS App Runner, making all nine tools accessible remotely for Claude Code with bearer token authentication. Includes `Dockerfile.mcp`, a dedicated CI/CD workflow (`deploy-mcp.yml`) with path-based triggers, and `.mcp.json` updated to the live App Runner endpoint.

### [v0.10.0](./changelogs/v0.10.0.md) - 2026-02-26

New Feature: MCP Server for Cursor. All book-app tools (favourites CRUD, Gutenberg word search, semantic related-word search, code-execution statistics, and Plotly visualizations) are now exposed as a standalone MCP server via `mcp-server.js` using `@modelcontextprotocol/sdk` over stdio transport. Registered in `.cursor/mcp.json` so Cursor can invoke all nine tools natively.

### [v0.9.8](./changelogs/v0.9.8.md) - 2026-02-24

UI Redesign: Full visual overhaul of `public/css/style.css` to a black and white palette — white background, near-black text, hairline grey borders. Book tags updated with distinct muted colour tints (soft green, warm yellow, light orange) for the three book types. All typography, layout, and features unchanged.

### [v0.9.7](./changelogs/v0.9.7.md) - 2026-02-23

Migration: Moved deployment platform from GCP Cloud Run to AWS App Runner. Rewrote the CI/CD deploy job to authenticate via AWS OIDC, build and push images to Amazon ECR, and deploy with `aws apprunner update-service`. Added a standalone `GET /health` endpoint and made the MongoDB connection non-fatal for App Runner health checks. Removed `cloudbuild.yaml`.

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
