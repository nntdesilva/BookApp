# BookApp Changelog

All notable changes to the BookApp project are documented in version-specific files.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Version History

### Latest Versions

- **[v0.9.1](v0.9.1.md)** - 2026-02-17

  - Migration: Claude models for all AI features (except embeddings)
  - `aiService.js` and `assistantService.js` fully rewritten using `@anthropic-ai/sdk`
  - OpenAI retained only for `text-embedding-3-large` semantic word search
  - Claude Code Execution beta replaces OpenAI Assistants API

- **[v0.9.0](v0.9.0.md)** - 2026-02-14

  - Major Feature: Interactive Data Visualization using Plotly.js
  - Interactive charts: bar, pie, line, scatter, heatmap, sankey, histogram, treemap
  - Smart session-based caching for chart type switching

- **[v0.8.0](v0.8.0.md)** - 2026-02-13

  - Major Feature: Arbitrary Book Statistics via Code Interpreter
  - OpenAI Assistants API integration for Python code execution
  - Precise text analysis: sentences, word distributions, co-occurrence, readability

- **[v0.7.1](v0.7.1.md)** - 2026-02-08

  - Bug Fix: Eliminated intermediary AI response step
  - Silent function execution for word count queries
  - Improved user experience with direct answers

- **[v0.7.0](v0.7.0.md)** - 2026-02-07

  - Major Feature: Word Count in Books
  - Project Gutenberg integration for public domain books
  - Gutendex API search with fuzzy matching
  - AI-powered query interpretation

- **[v0.6.1](v0.6.1.md)** - 2026-02-04

  - Major Update: MongoDB Storage & User Authentication
  - Passport.js integration for secure user login/signup
  - Database-backed favorites with persistent storage
  - BCrypt password hashing and session management
  - User model with authentication middleware

- **[v0.6.0](v0.6.0.md)** - 2026-02-03

  - Major Feature: Favorites List Management
  - AI-powered CRUD operations for favorites
  - ISBN-13 validation with checksum verification
  - Session-based storage with MongoDB-ready architecture

- **[v0.5.0](v0.5.0.md)** - 2026-02-02

  - Major Refactor: Agentic Architecture
  - Meta-prompt system implementation
  - Removed colored badge detector
  - Enhanced topic change detection

- **[v0.4.1](v0.4.1.md)** - 2026-01-30

  - Bug Fix: Corrected badge color assignment
  - Preserved search intent in title correction logic

- **[v0.3.2](v0.3.2.md)** - 2026-01-26

  - Fixed standalone book title badging consistency
  - Fixed series name search returning incomplete titles
  - Enhanced system prompts and title identification

- **[v0.3.1](v0.3.1.md)** - 2026-01-25

  - Intelligent title identification using AI workflows
  - Badge accuracy improvements
  - UI refinements and styling updates

- **[v0.3.0](v0.3.0.md)** - 2026-01-25
  - Major Feature: Book Name Text Badges
  - Automatic book name detection and highlighting
  - Elegant badge styling and visual design

### Previous Versions

- **[v0.2.0](v0.2.0.md)** - 2026-01-24

  - Major Feature: Multi-Turn Chat Interaction
  - Session management and conversation history
  - Real-time messaging interface

- **[v0.1.0](v0.1.0.md)** - 2026-01-22
  - Initial Release
  - Core book search functionality
  - AI integration with OpenAI GPT-3.5-turbo

---

_For questions, issues, or contributions, please refer to the README.md file in the project root._
