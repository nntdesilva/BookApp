# BookApp - AI-Powered Book Search

A simple Express.js application that allows users to search for books and get detailed information powered by ChatGPT.

## Features

- Clean and modern user interface
- Search for any book by name
- Get AI-generated book information including:
  - Author
  - Publication year
  - Genre
  - Brief summary
- RESTful routing structure
- Responsive design

## Tech Stack

- **Backend**: Node.js with Express.js
- **Template Engine**: EJS with ejs-mate for layouts
- **AI Integration**: OpenAI ChatGPT API
- **Additional Packages**:
  - method-override for RESTful routes
  - dotenv for environment variables

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```bash
touch .env
```

3. Add your OpenAI API key to the `.env` file:
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
```

## Getting Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy and paste it into your `.env` file

## Usage

Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

Then open your browser and navigate to:
```
http://localhost:3000
```

## RESTful Routes

| Method | Route    | Description                    |
|--------|----------|--------------------------------|
| GET    | /        | Display home page with search form |
| POST   | /search  | Search for a book              |

## Project Structure

```
BookApp/
├── app.js                  # Main application file
├── package.json            # Dependencies and scripts
├── .env                    # Environment variables (not tracked)
├── .gitignore             # Git ignore file
├── README.md              # Project documentation
├── controllers/
│   └── bookController.js  # Book search controller
├── routes/
│   └── books.js           # Book routes
├── views/
│   ├── layouts/
│   │   └── boilerplate.ejs # Main layout template
│   ├── books/
│   │   └── index.ejs      # Home/search page
│   └── error.ejs          # Error page
└── public/
    └── css/
        └── style.css      # Styles
```

## How It Works

1. User enters a book name in the search bar
2. Form submits a POST request to `/search`
3. Controller receives the request and queries OpenAI's ChatGPT API
4. ChatGPT returns detailed information about the book
5. Information is displayed in a beautiful card below the search bar

## Error Handling

The app includes comprehensive error handling:
- Missing API key notification
- Empty search query validation
- API error handling
- User-friendly error messages

## License

ISC
