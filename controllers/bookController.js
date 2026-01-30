const OpenAI = require("openai");
const {
  classifyBookBadges,
  applyColoredBadges,
  analyzeBookOrSeries,
} = require("../utils/coloredBadgeDetector");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.index = (req, res) => {
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

    if (!process.env.OPENAI_API_KEY) {
      return res.render("books/index", {
        bookInfo: null,
        searchQuery: bookName,
        bookName: null,
        error:
          "OpenAI API key is not configured. Please add it to your .env file.",
      });
    }

    const titleCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a book title corrector. Your job is to ONLY fix spelling and capitalization errors while preserving the user's original intent.\n\nCRITICAL RULES:\n1. If the input is a series name (e.g., 'harry potter', 'lord of rings'), return the SERIES NAME with correct spelling/caps\n2. If the input is a book title (e.g., 'hary poter and the filosofers stone'), return the BOOK TITLE with correct spelling/caps\n3. DO NOT expand series names into book titles\n4. DO NOT shorten book titles into series names\n5. Preserve whether it's a series or a specific book\n\nExamples:\nInput: 'harry potter' → Output: Harry Potter (series name stays series name)\nInput: 'hary poter' → Output: Harry Potter (series name with spelling fixed)\nInput: 'harry potter and the filosofers stone' → Output: Harry Potter and the Philosopher's Stone (book title stays book title)\nInput: '48 lows of power' → Output: The 48 Laws of Power (add articles if needed)\nInput: 'lord of rings' → Output: The Lord of the Rings (series name with corrections)\nInput: 'the fellowship of ring' → Output: The Fellowship of the Ring (book title with corrections)\nInput: '1984' → Output: 1984 (already correct)\n\nReturn ONLY the corrected title, nothing else. No quotes, no explanations.",
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

    const quotedMatch = correctBookTitle.match(/["'"]([^"'"]+)["'"]/);
    if (quotedMatch) {
      correctBookTitle = quotedMatch[1];
    }

    const byAuthorMatch = correctBookTitle.match(/^(.+?)\s+by\s+.+$/i);
    if (byAuthorMatch) {
      correctBookTitle = byAuthorMatch[1].trim();
    }

    correctBookTitle = correctBookTitle.replace(/^["'"]|["'"]$/g, "");

    const seriesAnalysis = await analyzeBookOrSeries(correctBookTitle);
    const seriesName = seriesAnalysis.seriesName;
    const searchedBook = seriesAnalysis.isSeries ? null : correctBookTitle;

    const initialPrompt = seriesAnalysis.isSeries
      ? `Tell me about the "${correctBookTitle}" series. Include the author, publication years, genre, a brief overview of the series, and list the main books in order with [[double brackets]] around each individual book title. Provide this as an informative paragraph similar to what you'd find on Wikipedia.`
      : `Tell me about the book "${correctBookTitle}". Include the author, publication year, genre, and a brief summary.`;

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

6. PROVIDE DIRECT INFORMATION - Do not ask clarifying questions
   - When asked about a series, provide comprehensive information about the series
   - When asked about a book, provide comprehensive information about the book
   - Give a detailed paragraph similar to what you'd find on Wikipedia or Google
   - Do NOT ask questions back like "Are you referring to..." or "Just to clarify..."
   - Assume the user knows what they're asking for and provide the information directly

EXAMPLE RESPONSES:
✓ "[[The 48 Laws of Power]] is a non-fiction book by Robert Greene that explores strategies of power in human relationships."
✓ "[[Mastery]] focuses on achieving excellence through practice, mentorship, and self-discovery."
✓ "The Harry Potter series includes [[Harry Potter and the Philosopher's Stone]], [[Harry Potter and the Chamber of Secrets]], and five other books."
✓ "Harry Potter is a seven-book fantasy series by J.K. Rowling following wizard Harry Potter and his friends at Hogwarts School."
✗ "The 48 Laws of Power is written by..." (missing brackets on title)
✗ "[[Mastery]] focuses on achieving [[mastery]]..." (don't wrap the word in context)
✗ "The [[Harry Potter series]] includes..." (don't bracket series names)
✗ "[[Harry Potter]] is the first book..." (use complete title with full name)
✗ "Just to clarify, are you referring to..." (don't ask clarifying questions)`,
      },
      {
        role: "user",
        content: initialPrompt,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    let bookInfo = completion.choices[0].message.content;

    const classification = await classifyBookBadges(
      bookInfo,
      correctBookTitle,
      searchedBook,
      seriesName,
    );
    bookInfo = applyColoredBadges(bookInfo, classification);

    messages.push({
      role: "assistant",
      content: completion.choices[0].message.content,
    });

    req.session.conversationHistory = messages;
    req.session.searchQuery = correctBookTitle;
    req.session.bookName = searchedBook;
    req.session.seriesName = seriesName;

    res.render("books/index", {
      bookInfo,
      searchQuery: correctBookTitle,
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

    if (!req.session.conversationHistory) {
      return res.status(400).json({
        error: "No active conversation. Please search for a book first.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OpenAI API key is not configured.",
      });
    }

    req.session.conversationHistory.push({
      role: "user",
      content: message,
    });

    const messagesWithReminder = [
      ...req.session.conversationHistory.slice(0, -1),
      {
        role: "user",
        content: `REMINDER: You MUST wrap ALL book titles in [[double brackets]]. Examples: [[War and Peace]], [[Anna Karenina]], [[The Fellowship of the Ring]].

User question: ${message}`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messagesWithReminder,
      temperature: 0.7,
      max_tokens: 300,
    });

    let aiResponse = completion.choices[0].message.content;

    const classification = await classifyBookBadges(
      aiResponse,
      req.session.searchQuery,
      req.session.bookName,
      req.session.seriesName,
    );
    const coloredResponse = applyColoredBadges(aiResponse, classification);

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
