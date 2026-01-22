const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

module.exports.index = (req, res) => {
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
