const OpenAI = require("openai");
const {
  classifyBookBadges,
  applyColoredBadges,
  getSeriesInfo,
  isSeriesQuery,
} = require("../utils/coloredBadgeDetector");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.index = (req, res) => {
  // Clear any existing conversation history
  req.session.conversationHistory = null;
  req.session.bookName = null;
  req.session.seriesName = null;
  req.session.searchQuery = null;
  res.render("books/index", {
    bookInfo: null,
    searchQuery: "",
    bookName: null,
    error: null,
  });
};

module.exports.search = async (req, res) => {
  try {
    const { bookName } = req.body;

    if (!bookName || bookName.trim() === "") {
      return res.render("books/index", {
        bookInfo: null,
        searchQuery: "",
        bookName: null,
        error: "Please enter a book name",
      });
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.render("books/index", {
        bookInfo: null,
        searchQuery: bookName,
        bookName: null,
        error:
          "OpenAI API key is not configured. Please add it to your .env file.",
      });
    }

    // First, get the correct book title
    const titleCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a book title identifier. Return ONLY the COMPLETE book title, nothing else. No quotes, no author name, no explanations. Just the exact, full book title.\n\nIMPORTANT: If the input is a series name or character name (e.g., 'Harry Potter', 'Lord of the Rings'), return the FIRST book's complete title from that series.\n\nExamples:\nInput: 'Harry Potter' → Output: Harry Potter and the Philosopher's Stone\nInput: 'Lord of the Rings' → Output: The Fellowship of the Ring\nInput: '48 laws of power' → Output: The 48 Laws of Power\nInput: '1984' → Output: 1984",
        },
        {
          role: "user",
          content: `${bookName}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 50,
    });

    let correctBookTitle = titleCompletion.choices[0].message.content.trim();

    // Extract title from quotes if present
    const quotedMatch = correctBookTitle.match(/["'"]([^"'"]+)["'"]/);
    if (quotedMatch) {
      correctBookTitle = quotedMatch[1];
    }

    // Remove author name if present (e.g., "Title by Author")
    const byAuthorMatch = correctBookTitle.match(/^(.+?)\s+by\s+.+$/i);
    if (byAuthorMatch) {
      correctBookTitle = byAuthorMatch[1].trim();
    }

    // Remove any leading/trailing quotes
    correctBookTitle = correctBookTitle.replace(/^["'"]|["'"]$/g, "");

    // Initialize conversation history with the book context
    const messages = [
      {
        role: "system",
        content: `You are a helpful book expert. CRITICAL: You MUST wrap every book title you mention in double brackets [[like this]].

MANDATORY WRAPPING RULES:
1. ALWAYS wrap COMPLETE book titles with [[double brackets]]
   - Full title including "The" if part of title: [[The 48 Laws of Power]] NOT [[48 Laws of Power]]
   - Full title for series books: [[Harry Potter and the Philosopher's Stone]] NOT [[Harry Potter]]
   - Wrap EVERY time you mention a book title, even multiple times in the response

2. DO NOT wrap partial or incomplete titles
   - Wrong: [[Harry Potter]] (missing full title)
   - Correct: [[Harry Potter and the Philosopher's Stone]]
   - Wrong: [[48 Laws of Power]] (missing "The")
   - Correct: [[The 48 Laws of Power]]

3. DO NOT wrap words when used in sentence context (NOT referring to the book)
   - If the word is a concept or used as adjective/noun in a sentence, DO NOT wrap it
   - Example: "[[Mastery]] focuses on achieving excellence in a field" ✓ (only book title is wrapped)
   - Wrong: "[[Mastery]] focuses on achieving [[mastery]] in a field" ✗ (don't wrap the word "mastery")
   - Example: "[[The 48 Laws of Power]] explores the dynamics of power" ✓ (only book title is wrapped)
   - Wrong: "explores the dynamics of [[power]]" ✗ (don't wrap concept words)

4. DO NOT wrap series names - ONLY wrap individual book titles
   - NEVER wrap a series name, even if it's the answer to a question
   - Wrong: "The [[Harry Potter series]] includes..." 
   - Correct: "The Harry Potter series includes [[Harry Potter and the Philosopher's Stone]], [[Harry Potter and the Chamber of Secrets]]..."
   - Wrong: "The [[Lord of the Rings trilogy]]..."
   - Correct: "The Lord of the Rings trilogy includes [[The Fellowship of the Ring]], [[The Two Towers]], [[The Return of the King]]"
   - Wrong: "J.K. Rowling's detective series is called [[Cormoran Strike]]" (Cormoran Strike is a SERIES name)
   - Correct: "J.K. Rowling's detective series is called Cormoran Strike" (no wrapping for series names)
   - Exception: If a series name is ALSO the title of the first book (e.g., "The Hunger Games"), wrap it ONLY when referring to the book specifically, NOT when referring to the series

5. DO NOT wrap author names, genres, publishers, or other text
   - Never wrap: Robert Greene, J.K. Rowling, dystopian fiction, Penguin Books, etc.

EXAMPLE RESPONSES:
✓ "[[The 48 Laws of Power]] is a non-fiction book by Robert Greene that explores strategies of power in human relationships."
✓ "[[Mastery]] focuses on achieving excellence through practice, mentorship, and self-discovery."
✓ "The Harry Potter series includes [[Harry Potter and the Philosopher's Stone]], [[Harry Potter and the Chamber of Secrets]], and five other books."
✗ "The 48 Laws of Power is written by..." (missing brackets on title)
✗ "[[Mastery]] focuses on achieving [[mastery]]..." (don't wrap the word in context)
✗ "The [[Harry Potter series]] includes..." (don't bracket series names)
✗ "[[Harry Potter]] is the first book..." (use complete title with full name)`,
      },
      {
        role: "user",
        content: `Tell me about the book "${correctBookTitle}". Include the author, publication year, genre, and a brief summary.`,
      },
    ];

    // Get detailed information about the book using the correct title
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    let bookInfo = completion.choices[0].message.content;

    // Check if the user searched for a series name
    const seriesQueryCheck = isSeriesQuery(bookName);

    // Get series information for the searched book
    const seriesInfo = getSeriesInfo(correctBookTitle);
    const seriesName = seriesQueryCheck.isSeries
      ? seriesQueryCheck.seriesName
      : seriesInfo.isPartOfSeries
        ? seriesInfo.seriesName
        : null;

    // Determine the searched book
    // If user searched for a series name, searchedBook should be null
    // If user searched for a specific book, searchedBook should be that book
    const searchedBook = seriesQueryCheck.isSeries ? null : correctBookTitle;

    // Apply colored badges to the book info
    const classification = classifyBookBadges(
      bookInfo,
      bookName,
      searchedBook,
      seriesName,
    );
    bookInfo = applyColoredBadges(bookInfo, classification);

    // Add assistant response to conversation history (store original with [[]] for future classification)
    messages.push({
      role: "assistant",
      content: completion.choices[0].message.content,
    });

    // Store the complete conversation history in session
    req.session.conversationHistory = messages;
    req.session.searchQuery = bookName; // Store the ORIGINAL search query
    req.session.bookName = searchedBook; // Store the actual searched book (null for series searches)
    req.session.seriesName = seriesName;

    res.render("books/index", {
      bookInfo,
      searchQuery: bookName,
      bookName: correctBookTitle,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching book information:", error);
    res.render("books/index", {
      bookInfo: null,
      searchQuery: req.body.bookName || "",
      bookName: null,
      error:
        "An error occurred while fetching book information. Please try again.",
    });
  }
};

module.exports.chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({
        error: "Please enter a message",
      });
    }

    // Check if conversation history exists
    if (!req.session.conversationHistory) {
      return res.status(400).json({
        error: "No active conversation. Please search for a book first.",
      });
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OpenAI API key is not configured.",
      });
    }

    // Add user message to conversation history
    req.session.conversationHistory.push({
      role: "user",
      content: message,
    });

    // Create messages array with wrapping reminder for this request
    const messagesWithReminder = [
      ...req.session.conversationHistory.slice(0, -1), // All messages except the last user message
      {
        role: "user",
        content: `REMINDER: You MUST wrap ALL book titles in [[double brackets]]. Examples: [[War and Peace]], [[Anna Karenina]], [[The Fellowship of the Ring]].

User question: ${message}`,
      },
    ];

    // Create a chat completion request with reminder
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messagesWithReminder,
      temperature: 0.7,
      max_tokens: 300,
    });

    let aiResponse = completion.choices[0].message.content;

    // Apply colored badges to the AI response
    const classification = classifyBookBadges(
      aiResponse,
      req.session.searchQuery, // Use the ORIGINAL search query, not the book name
      req.session.bookName,
      req.session.seriesName,
    );
    const coloredResponse = applyColoredBadges(aiResponse, classification);

    // Add assistant response to conversation history (store original with [[]] for future classification)
    req.session.conversationHistory.push({
      role: "assistant",
      content: aiResponse,
    });

    res.json({
      success: true,
      response: coloredResponse,
      bookName: req.session.bookName,
    });
  } catch (error) {
    console.error("Error in chat:", error);
    res.status(500).json({
      error:
        "An error occurred while processing your message. Please try again.",
    });
  }
};
