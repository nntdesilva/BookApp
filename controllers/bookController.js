const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

module.exports.index = (req, res) => {
    // Clear any existing conversation history
    req.session.conversationHistory = null;
    req.session.bookName = null;
    res.render('books/index', { bookInfo: null, searchQuery: '', bookName: null, error: null });
};

module.exports.search = async (req, res) => {
    try {
        const { bookName } = req.body;
        
        if (!bookName || bookName.trim() === '') {
            return res.render('books/index', { 
                bookInfo: null, 
                searchQuery: '',
                bookName: null,
                error: 'Please enter a book name' 
            });
        }

        // Check if API key is configured
        if (!process.env.OPENAI_API_KEY) {
            return res.render('books/index', { 
                bookInfo: null, 
                searchQuery: bookName,
                bookName: null,
                error: 'OpenAI API key is not configured. Please add it to your .env file.' 
            });
        }

        // First, get the correct book title
        const titleCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a book title identifier. Return ONLY the book title, nothing else. No quotes, no author name, no explanations. Just the exact title. Examples: 'Harry Potter and the Philosopher's Stone' or 'The 48 Laws of Power' or '1984'"
                },
                {
                    role: "user",
                    content: `${bookName}`
                }
            ],
            temperature: 0.3,
            max_tokens: 50
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
        correctBookTitle = correctBookTitle.replace(/^["'"]|["'"]$/g, '');

        // Initialize conversation history with the book context
        const messages = [
            {
                role: "system",
                content: `You are a helpful book expert. The user has just searched for information about a book. Provide detailed, conversational answers to their follow-up questions about this book or related topics. Keep responses concise but informative. IMPORTANT: When referring to the book title, always use this exact format: "${correctBookTitle}"`
            },
            {
                role: "user",
                content: `Tell me about the book "${correctBookTitle}". Include the author, publication year, genre, and a brief summary.`
            }
        ];

        // Get detailed information about the book using the correct title
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 0.7,
            max_tokens: 300
        });

        const bookInfo = completion.choices[0].message.content;

        // Add assistant response to conversation history
        messages.push({
            role: "assistant",
            content: bookInfo
        });

        // Store the complete conversation history in session
        req.session.conversationHistory = messages;
        req.session.bookName = correctBookTitle;

        res.render('books/index', { 
            bookInfo, 
            searchQuery: bookName,
            bookName: correctBookTitle,
            error: null 
        });

    } catch (error) {
        console.error('Error fetching book information:', error);
        res.render('books/index', { 
            bookInfo: null, 
            searchQuery: req.body.bookName || '',
            bookName: null,
            error: 'An error occurred while fetching book information. Please try again.' 
        });
    }
};

module.exports.chat = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ 
                error: 'Please enter a message' 
            });
        }

        // Check if conversation history exists
        if (!req.session.conversationHistory) {
            return res.status(400).json({ 
                error: 'No active conversation. Please search for a book first.' 
            });
        }

        // Check if API key is configured
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ 
                error: 'OpenAI API key is not configured.' 
            });
        }

        // Add user message to conversation history
        req.session.conversationHistory.push({
            role: "user",
            content: message
        });

        // Create a chat completion request with full conversation history
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: req.session.conversationHistory,
            temperature: 0.7,
            max_tokens: 300
        });

        const aiResponse = completion.choices[0].message.content;

        // Add assistant response to conversation history
        req.session.conversationHistory.push({
            role: "assistant",
            content: aiResponse
        });

        res.json({ 
            success: true,
            response: aiResponse,
            bookName: req.session.bookName 
        });

    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ 
            error: 'An error occurred while processing your message. Please try again.' 
        });
    }
};
