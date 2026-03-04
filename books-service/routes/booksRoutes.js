const express = require("express");
const gutenbergService = require("../services/gutenbergService");

const router = express.Router();

router.post("/resolve", async (req, res) => {
  try {
    const { bookTitle } = req.body;
    const result = await gutenbergService.resolveBookForSearch(bookTitle);
    res.json(result);
  } catch (error) {
    console.error("[books-service] Resolve error:", error);
    res.status(500).json({ available: false, error: error.message });
  }
});

router.post("/count-word", async (req, res) => {
  try {
    const { bookTitle, searchTerm } = req.body;
    const result = await gutenbergService.countWordInBook(bookTitle, searchTerm);
    res.json(result);
  } catch (error) {
    console.error("[books-service] Count word error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/count-related", async (req, res) => {
  try {
    const { bookTitle, concept } = req.body;
    const result = await gutenbergService.countRelatedWordsInBook(bookTitle, concept);
    res.json(result);
  } catch (error) {
    console.error("[books-service] Count related error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/text", async (req, res) => {
  try {
    const { bookTitle } = req.body;
    const result = await gutenbergService.getBookFullText(bookTitle);
    res.json(result);
  } catch (error) {
    console.error("[books-service] Text error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
