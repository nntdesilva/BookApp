const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

module.exports.index = (req, res) => {
    // Clear any existing conversation history
    req.session.conversationHistory = null;
    req.session.bookName = null;
    res.render('books/index', { bookInfo: null, searchQuery: '', error: null });
};

module.exports.search = async (req, res) => {
    try {
        const { bookName } = req.body;
        
        if (!bookName || bookName.trim() === '') {
            return res.render('books/index', { 
                bookInfo: null, 
                searchQuery: '',
                error: 'Please enter a book name' 
            });
        }

        // Check if API key is configured
        if (!process.env.OPENAI_API_KEY) {
            return res.render('books/index', { 
                bookInfo: null, 
                searchQuery: bookName,
                error: 'OpenAI API key is not configured. Please add it to your .env file.' 
            });
        }

        // Create a chat completion request to get book information
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful book expert. Provide detailed information about books including author, publication year, genre, and a brief summary. Keep responses concise but informative (around 150-200 words)."
                },
                {
                    role: "user",
                    content: `Tell me about the book "${bookName}". Include the author, publication year, genre, and a brief summary.`
                }
            ],
            temperature: 0.7,
            max_tokens: 300
        });

        const bookInfo = completion.choices[0].message.content;

        // Initialize conversation history with the book context
        req.session.conversationHistory = [
            {
                role: "system",
                content: "You are a helpful book expert. The user has just searched for information about a book. Provide detailed, conversational answers to their follow-up questions about this book or related topics. Keep responses concise but informative."
            },
            {
                role: "user",
                content: `Tell me about the book "${bookName}". Include the author, publication year, genre, and a brief summary.`
            },
            {
                role: "assistant",
                content: bookInfo
            }
        ];
        req.session.bookName = bookName;

        res.render('books/index', { 
            bookInfo, 
            searchQuery: bookName,
            error: null 
        });

    } catch (error) {
        console.error('Error fetching book information:', error);
        res.render('books/index', { 
            bookInfo: null, 
            searchQuery: req.body.bookName || '',
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
            response: aiResponse 
        });

    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ 
            error: 'An error occurred while processing your message. Please try again.' 
        });
    }
};
