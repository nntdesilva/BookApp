/**
 * Book Routes - Defines all routes related to book operations
 */

const express = require("express");
const router = express.Router();
const bookController = require("../controllers/bookController");

// Main page - display book chat interface
router.get("/", bookController.index);

// Chat endpoint - handle user messages
router.post("/chat", bookController.chat);

// Clear conversation history
router.post("/clear", bookController.clearHistory);

// Get conversation statistics
router.get("/stats", bookController.getStats);

module.exports = router;
