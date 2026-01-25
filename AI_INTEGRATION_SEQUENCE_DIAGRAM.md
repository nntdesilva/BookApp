# AI ChatGPT Integration - Sequence Diagram

## Overview
This document illustrates how the ChatGPT API integration works in the BookApp application.

## Sequence Diagram (Mermaid)

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant ExpressApp
    participant Session
    participant BookController
    participant OpenAI_API

    Note over User,OpenAI_API: FLOW 1: Initial Book Search

    User->>Browser: Visit homepage
    Browser->>ExpressApp: GET /
    ExpressApp->>BookController: index()
    BookController->>Session: Clear conversation history
    BookController->>Browser: Render index.ejs (empty state)
    Browser->>User: Display search form

    User->>Browser: Enter book name & submit
    Browser->>ExpressApp: POST /search {bookName}
    ExpressApp->>BookController: search(req, res)
    
    BookController->>BookController: Validate input
    alt Invalid input
        BookController->>Browser: Render with error
        Browser->>User: Show error message
    else Valid input
        BookController->>BookController: Check API key
        alt API key missing
            BookController->>Browser: Render with error
            Browser->>User: Show API key error
        else API key exists
            BookController->>OpenAI_API: chat.completions.create()<br/>{model: "gpt-3.5-turbo",<br/>messages: [system, user],<br/>temperature: 0.7,<br/>max_tokens: 300}
            
            Note over OpenAI_API: Process request with<br/>GPT-3.5-turbo model
            
            OpenAI_API-->>BookController: Return book information
            
            BookController->>Session: Store conversation history<br/>[system, user, assistant]
            BookController->>Session: Store bookName
            BookController->>Browser: Render index.ejs with bookInfo
            Browser->>User: Display book information
        end
    end

    Note over User,OpenAI_API: FLOW 2: Chat Follow-up Questions

    User->>Browser: Type follow-up question
    Browser->>ExpressApp: POST /chat {message}
    ExpressApp->>BookController: chat(req, res)
    
    BookController->>BookController: Validate message
    alt Invalid message
        BookController->>Browser: JSON {error}
        Browser->>User: Show error
    else Valid message
        BookController->>Session: Check conversation history
        alt No conversation history
            BookController->>Browser: JSON {error: "No active conversation"}
            Browser->>User: Show error
        else Conversation exists
            BookController->>BookController: Check API key
            alt API key missing
                BookController->>Browser: JSON {error}
                Browser->>User: Show error
            else API key exists
                BookController->>Session: Add user message to history
                
                BookController->>OpenAI_API: chat.completions.create()<br/>{model: "gpt-3.5-turbo",<br/>messages: conversationHistory,<br/>temperature: 0.7,<br/>max_tokens: 300}
                
                Note over OpenAI_API: Process with full<br/>conversation context
                
                OpenAI_API-->>BookController: Return AI response
                
                BookController->>Session: Add assistant response to history
                BookController->>Browser: JSON {success: true, response}
                Browser->>User: Display AI response in chat
            end
        end
    end
```

## Key Components

### 1. **User & Browser**
- User interacts with the web interface
- Browser handles form submissions and AJAX requests

### 2. **Express App**
- Main application server
- Routes requests to appropriate controllers
- Manages middleware (sessions, JSON parsing, etc.)

### 3. **Session**
- Stores conversation history between requests
- Maintains context for follow-up questions
- Stores current book name

### 4. **Book Controller**
- **index()**: Initializes the app, clears session
- **search()**: Handles book search requests
- **chat()**: Handles follow-up chat messages

### 5. **OpenAI API**
- External API service (GPT-3.5-turbo model)
- Processes natural language requests
- Returns book information and chat responses

## Data Flow Details

### Initial Search Request
```javascript
// Request to OpenAI
{
  model: "gpt-3.5-turbo",
  messages: [
    {
      role: "system",
      content: "You are a helpful book expert..."
    },
    {
      role: "user",
      content: "Tell me about the book \"[bookName]\"..."
    }
  ],
  temperature: 0.7,
  max_tokens: 300
}
```

### Chat Follow-up Request
```javascript
// Request to OpenAI (includes full history)
{
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "Tell me about..." },
    { role: "assistant", content: "..." },
    { role: "user", content: "Follow-up question" }
    // ... more messages
  ],
  temperature: 0.7,
  max_tokens: 300
}
```

## Session Storage Structure

```javascript
req.session = {
  conversationHistory: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
    { role: "assistant", content: "..." },
    // ... more messages as conversation continues
  ],
  bookName: "Name of searched book"
}
```

## Error Handling

The application handles several error scenarios:
1. Empty or missing input
2. Missing OpenAI API key
3. No active conversation (for chat)
4. OpenAI API errors
5. Network/server errors

## Technology Stack

- **Backend**: Node.js + Express
- **Session Management**: express-session
- **AI Integration**: OpenAI SDK (openai npm package)
- **View Engine**: EJS
- **Model**: GPT-3.5-turbo

## Configuration

Required environment variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `SESSION_SECRET`: Secret for session encryption

