const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

// RESTful Routes
// GET / - Display home page with search form
router.get('/', bookController.index);

// POST /search - Search for a book
router.post('/search', bookController.search);

// POST /chat - Send a chat message
router.post('/chat', bookController.chat);

module.exports = router;
