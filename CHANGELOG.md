# Changelog

All notable changes to the BookApp project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-01-25

### Fixed

#### Book Name Text Badges - Correct Title Recognition
- **Intelligent Title Identification**: Added two-stage OpenAI API call to identify and use correct book titles
  - First API call identifies the correct, full book title from partial or misspelled user input
  - Second API call retrieves book information using the identified correct title
- **Badge Accuracy**: Badges now highlight the actual book title (e.g., "The 48 Laws of Power") instead of user's search query (e.g., "48 laws of power")
- **Misspelling Handling**: System automatically corrects misspelled book names and badges the correct title
- **Partial Query Support**: Works with incomplete book titles - identifies and displays the full correct name
- **Implementation Details**:
  - New title identification prompt with low temperature (0.3) for consistent results
  - Correct title stored in session for consistent badging across chat responses
  - Search query preserved separately for form display purposes

#### UI Refinements
- **Badge Styling Improvement**: Updated book name badges to use more subtle, theme-consistent colors
  - Changed from bright yellow (`#f4d03f`) to soft beige (`#e8dfc8`)
  - Updated border from gold (`#d4af37`) to muted tan (`#d4c5a9`)
  - Hover state now uses `#d4c5a9` for a gentle interaction effect
  - Colors harmonize with the cream/tan literary theme throughout the app

#### Code Quality
- **Linter Error Resolution**: Fixed CSS linter warnings in `index.ejs`
  - Replaced inline style attribute with conditional CSS class approach
  - Added `.hidden` utility class to CSS for better maintainability
  - Improved separation of concerns between markup and styling

### Technical Improvements
- **API Efficiency**: Title identification uses max_tokens: 50 for faster responses
- **Session Management**: Enhanced to store correct book title rather than raw user input
- **Conversation Context**: Chat history now references the correct book title for better AI responses
- **CSS Architecture**: Added reusable utility class for hiding elements

## [0.3.0] - 2026-01-25

### Major Feature: Book Name Text Badges

Enhanced visual recognition by automatically highlighting every occurrence of the searched book's title with subtle, elegant text badges throughout the application.

### Added

#### Text Badge Highlighting System
- **Automatic Book Name Detection**: Client-side function that identifies all occurrences of the book title in displayed content
- **Case-Insensitive Matching**: Regex-based pattern matching that catches book names regardless of capitalization
- **Special Character Handling**: Proper escaping of special regex characters in book titles
- **Badge Application**:
  - Initial book information paragraph
  - All user messages in chat
  - All AI responses in chat

#### Visual Design
- **Subtle Highlight Effect**: Soft gradient highlighting the bottom 40% of text with translucent beige
- **Delicate Border**: 1px bottom border in site's tan color palette with transparency
- **Italic Styling**: Gentle emphasis without disrupting reading flow
- **Interactive Hover State**: Badges subtly intensify on hover for better user feedback
- **Literary Aesthetic**: Design inspired by book annotation style, mimicking a translucent marker

#### Implementation Details
- **Client-Side Processing**: JavaScript-based badge application for optimal performance
- **DOM Manipulation**: Dynamic HTML injection with `innerHTML` for badge spans
- **Text Preservation**: Uses `textContent` extraction before badge application to avoid HTML conflicts
- **Session Integration**: Book name stored in session and passed to both view and chat responses
- **Consistent Styling**: Badge CSS integrated with existing Playfair Display typography

#### Backend Enhancements
- **Controller Updates**: Modified `bookController.js` to pass `bookName` variable to views
- **Chat Response**: Chat endpoint now returns book name with each response
- **Null Safety**: Added proper handling for cases where no book name exists

### Changed
- **appendMessage Function**: Enhanced with optional `applyBadges` parameter for selective badge application
- **Book Content Display**: Added `id="bookContent"` for JavaScript targeting
- **Error Message Handling**: Error messages bypass badge application for clarity

### Technical Improvements
- **XSS Protection**: Controlled HTML injection with sanitized, fixed badge structure
- **Performance**: Minimal regex operations with efficient global replacement
- **Maintainability**: Clear separation between badge logic and message display logic

## [0.2.0] - 2026-01-24

### Major Feature: Multi-Turn Chat Interaction

Upgraded from single-turn request-response pattern to a conversational multi-turn chat interface, enabling contextual follow-up questions about searched books.

### Added

#### Chat Functionality
- **Multi-Turn Conversations**: Implemented stateful chat system that maintains conversation context across multiple interactions
- **New Chat Endpoint**: Added POST `/chat` route for handling follow-up messages
- **Session Management**: Integrated `express-session` for maintaining conversation history
- **Conversation History Tracking**: Stores full message history in server-side sessions
  - System prompts for context
  - User messages
  - Assistant responses
- **Context-Aware Responses**: AI maintains awareness of the book being discussed throughout the conversation

#### Chat User Interface
- **Interactive Chat Section**: Modern chat interface displayed after initial book search
- **Real-Time Messaging**: AJAX-based message sending without page reloads
- **Message Display**:
  - User messages styled with distinct appearance
  - AI responses styled differently for clear conversation flow
  - Error messages with appropriate styling
- **Typing Indicator**: Animated three-dot indicator while AI processes responses
- **Chat Input Controls**:
  - Text input field with placeholder
  - Send button with paper plane icon
  - Auto-focus on chat input after book search
  - Input disable/enable during message processing
- **Auto-Scroll**: Messages container automatically scrolls to show latest message

#### Client-Side JavaScript
- **Async Communication**: Fetch API integration for non-blocking chat interactions
- **Form Handling**: JavaScript form submission preventing page reloads
- **Dynamic DOM Manipulation**: Functions for adding messages, indicators, and managing chat state
- **Error Handling**: Client-side error catching and user-friendly error display

#### Backend Architecture
- **Chat Controller Method**: New `chat` method in `bookController.js`
  - Validates incoming messages
  - Checks for active conversation session
  - Manages conversation history array
  - Handles OpenAI API calls with full context
  - Updates session with new messages
- **Session-Based State**: Conversation persistence during user session
  - Stores `conversationHistory` array in session
  - Tracks `bookName` for context
  - Session cleared on new search (via index route)
- **Enhanced Search Method**: Modified to initialize conversation history after first search

#### Dependencies
- **Production**:
  - express-session ^1.19.0 - Session management for conversation persistence

#### Configuration
- **Session Configuration**:
  - Secret key (configurable via SESSION_SECRET environment variable)
  - 24-hour session cookie lifetime
  - Secure session options (resave: false, saveUninitialized: false)

### Changed

#### Architecture Upgrade
- **From Single-Turn to Multi-Turn**: Complete architectural shift
  - **Before**: `User Search → API Call → Response → End`
  - **After**: `User Search → Initialize Session → Display + Chat → Multiple Exchanges → Maintain Context`
- **State Management**: Changed from stateless to stateful application
- **AI Integration Pattern**: Evolved from simple API call to conversation management

#### Controller Logic
- **Index Method**: Now clears conversation history and book name from session
- **Search Method**: Enhanced to initialize conversation history after successful search
  - Stores system prompt, user query, and initial response
  - Sets up context for follow-up questions
- **New Interaction Flow**: Search initializes conversation, chat maintains it

#### User Interface
- **Results Page**: Enhanced with integrated chat section below book information
- **Session-Aware**: UI components respond to conversation state

#### Routes
- **Additional Endpoint**: Routes file now includes chat route alongside existing routes

### Technical Specifications

#### Conversation Management
- **Message Structure**: OpenAI chat format with role-based messages
  - System role: Book expert instructions
  - User role: Questions and queries
  - Assistant role: AI responses
- **Context Window**: Full conversation history sent with each API call
- **Session Lifecycle**: 
  - Created on first book search
  - Persists for 24 hours
  - Cleared when user performs new search

#### API Integration
- **Model**: Still using GPT-3.5-turbo
- **Temperature**: 0.7 (unchanged)
- **Max Tokens**: 300 per response (unchanged)
- **Request Type**: Chat completions with message array instead of single prompt

#### Multi-Turn Conversation Architecture

**Conversational Pattern** (Session-Based)

```
Initial Search:
User → Search → OpenAI API → Response → Initialize Session
                                              ↓
                                      [Conversation History]
                                              ↓
Follow-up Chat:
User Question → Add to History → OpenAI API (with context)
                                      ↓
                              AI Response → Add to History
                                      ↓
                              [Session Persists] → Loop continues
```

**Conversation Flow:**
1. User searches for book → Initial response generated
2. System stores: system prompt + user query + AI response
3. User asks follow-up → Full history sent to OpenAI
4. AI responds with context → Response added to history
5. Repeat steps 3-4 for ongoing conversation
6. New search → Clear history → Start fresh conversation

### Security
- **Session Secret**: Configurable via environment variable with fallback
- **Session Validation**: Chat endpoint validates active session before processing
- **Input Sanitization**: Trim and validate chat messages on both client and server

### Known Improvements
- Application is now stateful (sessions required)
- Enables natural, contextual conversations about books
- Users can ask follow-up questions without repeating context
- Better user experience with real-time chat interaction

### Developer Notes
- Session storage is in-memory (will not persist across server restarts)
- For production, consider using external session store (Redis, MongoDB)
- Conversation history grows with each message (consider implementing limits)

---

## [0.1.0] - 2026-01-22

### Initial Release

BookApp is an AI-powered book search application that allows users to search for books and receive detailed information powered by OpenAI's ChatGPT API. The application features a clean, elegant literary-themed interface inspired by classic libraries.

### Added

#### Core Functionality
- **Book Search Feature**: Implemented POST `/search` endpoint for searching books by name
- **AI Integration**: Integrated OpenAI ChatGPT API (GPT-3.5-turbo) for intelligent book information retrieval
- **Smart Book Information**: AI returns comprehensive details including:
  - Author name
  - Publication year
  - Genre classification
  - Brief summary (150-200 words)

#### Architecture & Structure
- **MVC Pattern**: Organized codebase following Model-View-Controller architecture
  - Controllers: `bookController.js` handles search logic and AI interaction
  - Routes: `books.js` defines RESTful routing structure
  - Views: EJS templates with layout system
- **Express.js Server**: Main application setup in `app.js` with middleware configuration
- **RESTful Routes**: Clean routing structure with GET `/` for home and POST `/search` for queries

#### Frontend & UI
- **Elegant Design**: Literary-themed interface named "Bibliothèque - A Literary Collection"
- **Typography**: Premium fonts (Playfair Display, Cormorant Garamond) for sophisticated look
- **Color Scheme**: Warm, book-inspired palette (#f8f6f1 background, #1a1a1a text, #d4c5a9 accents)
- **Responsive Design**: Mobile-friendly layout with media queries for tablets and phones
- **Animated Elements**: Smooth fade-in animations for results and error messages
- **Search Interface**: 
  - Clean search bar with integrated search button
  - Retains search query after submission
  - Welcome message when no search performed
- **Results Display**:
  - Elegant card design with decorative quotation mark
  - Pre-formatted AI response with proper line spacing
  - "New Search" button for easy navigation back to home

#### Template System
- **EJS with ejs-mate**: Implemented layout system for consistent page structure
- **Boilerplate Layout**: Reusable layout template for all pages
- **Component Views**:
  - `books/index.ejs`: Main search and results page
  - `error.ejs`: Error handling page
- **FontAwesome Integration**: Icon support for enhanced visual elements

#### Error Handling
- **API Key Validation**: Checks for missing OpenAI API key with user-friendly message
- **Empty Search Prevention**: Validates search input before API call
- **API Error Handling**: Graceful degradation when OpenAI API fails
- **User Feedback**: Clear error messages displayed in elegant alert boxes
- **Global Error Middleware**: Catches and handles all application errors

#### Configuration & Environment
- **Environment Variables**: 
  - dotenv integration for secure API key storage
  - Configurable PORT (defaults to 3000)
  - OPENAI_API_KEY for API authentication
- **Git Integration**: Comprehensive `.gitignore` file to protect sensitive data

#### Development Tools
- **Package Management**: 
  - npm scripts for `start` (production) and `dev` (with nodemon)
  - All dependencies properly versioned in `package.json`
- **Development Server**: nodemon for auto-reload during development

#### Dependencies
- **Production**:
  - express ^4.18.2 - Web framework
  - ejs ^3.1.9 - Template engine
  - ejs-mate ^4.0.0 - Layout support
  - method-override ^3.0.0 - RESTful HTTP verbs
  - dotenv ^16.3.1 - Environment variable management
  - openai ^4.20.1 - OpenAI API client
- **Development**:
  - nodemon ^3.0.1 - Auto-reload development server

#### Documentation
- **README.md**: Comprehensive project documentation including:
  - Feature list and tech stack
  - Installation instructions
  - OpenAI API key setup guide
  - Usage instructions
  - RESTful routes documentation
  - Project structure overview
  - How it works explanation
- **Code Comments**: Inline documentation in route files and controllers

#### Security
- **API Key Protection**: `.env` file gitignored to prevent key exposure
- **Input Validation**: Server-side validation for search queries
- **Error Stack Hiding**: Production-ready error handling that doesn't expose stack traces to users

### Technical Specifications

#### OpenAI Configuration
- Model: GPT-3.5-turbo
- Temperature: 0.7 (balanced creativity)
- Max Tokens: 300 (optimal for book summaries)
- System Prompt: Configured as helpful book expert with concise response instructions

#### Server Configuration
- Port: 3000 (configurable via environment variable)
- Middleware Stack:
  - express.urlencoded (form parsing)
  - express.json (JSON parsing)
  - method-override (RESTful support)
  - express.static (static file serving)

#### AI Agent Architecture

**Single Turn Pattern** (Not Agentic Workflow)

```
User Search → Controller → OpenAI API Call → Response → Display
                          (single turn, stateless)
```

### Project Structure

```
BookApp/
├── app.js                  # Express server & middleware configuration
├── package.json            # Dependencies and npm scripts
├── .env                    # Environment variables (gitignored)
├── .gitignore             # Git ignore rules
├── README.md              # Project documentation
├── CHANGELOG.md           # This file
├── controllers/
│   └── bookController.js  # Search logic & OpenAI integration
├── routes/
│   └── books.js           # RESTful route definitions
├── views/
│   ├── layouts/
│   │   └── boilerplate.ejs # Main HTML layout
│   ├── books/
│   │   └── index.ejs      # Search page & results display
│   └── error.ejs          # Error page template
└── public/
    └── css/
        └── style.css      # Complete styling (340+ lines)
```

### Known Limitations
- ~~Simple request-response AI pattern (not agentic workflow)~~ **[RESOLVED in v0.2.0]**
- ~~No user authentication or session management~~ **[PARTIALLY RESOLVED in v0.2.0 - sessions added]**
- No database integration (sessions stored in memory only)
- No user authentication
- No book history or favorites feature
- Relies on external API (OpenAI) for all book information
- No offline mode or caching
- Conversation history not persisted (lost on server restart)

### Future Considerations
Potential enhancements for future versions may include:
- ~~Multi-turn conversational interface~~ **[IMPLEMENTED in v0.2.0]**
- ~~Session management~~ **[IMPLEMENTED in v0.2.0]**
- Evolution to full agentic workflow architecture with tool use
- Database integration for:
  - Persistent conversation storage
  - Search history
  - External session store (Redis/MongoDB)
- User accounts and authentication
- Favorites/bookmarks system
- Multiple AI model support (GPT-4, Claude, etc.)
- Book cover image integration (external API)
- Advanced search filters (genre, year, author)
- Rating and review system
- Book recommendation engine
- Conversation export/sharing functionality
- Conversation history limits and management

---

## Release Notes

### Version 0.2.0 - Multi-Turn Chat Release

This release introduces conversational AI capabilities, transforming BookApp from a simple search tool into an interactive chat experience. Users can now have natural, flowing conversations about books with context-aware follow-up questions.

**Key Highlights:**
- Multi-turn chat interface with conversation memory
- Session-based state management
- Real-time messaging with typing indicators
- Contextual AI responses that remember previous exchanges

**Upgrade Notes:**
- New dependency: `express-session` (automatically installed via `npm install`)
- Optional: Set `SESSION_SECRET` in `.env` file for production
- Sessions stored in memory (consider external store for production scaling)

**Quick Start:**
```bash
npm install  # Install new dependencies
# Add SESSION_SECRET to .env (optional)
npm start
# Visit http://localhost:3000
```

---

### Version 0.1.0 - Initial Release

This is the first production-ready release of BookApp. The application is fully functional and provides a beautiful, elegant interface for searching and discovering books using AI-powered responses. All core features are stable and tested.

**Installation Requirements:**
- Node.js (v14 or higher recommended)
- npm or yarn package manager
- OpenAI API key

**Quick Start:**
```bash
npm install
# Create .env file with OPENAI_API_KEY
npm start
# Visit http://localhost:3000
```

---

*For questions, issues, or contributions, please refer to the README.md file.*
