const express = require("express");
const gutenbergService = require("../services/gutenbergService");
const logger = require("../config/logger").child({ component: "booksRoutes" });

const router = express.Router();

router.post("/resolve", async (req, res) => {
  try {
    const { bookTitle } = req.body;
    logger.info({ event: "resolve_attempt", bookTitle });
    const result = await gutenbergService.resolveBookForSearch(bookTitle);
    logger.info({ event: "resolve_complete", bookTitle, available: result.available, gutenbergId: result.gutenbergId });
    res.json(result);
  } catch (error) {
    logger.error({ event: "resolve_error", bookTitle: req.body?.bookTitle, err: error });
    res.status(500).json({ available: false, error: error.message });
  }
});

router.post("/count-word", async (req, res) => {
  const t0 = Date.now();
  try {
    const { bookTitle, searchTerm } = req.body;
    logger.info({ event: "count_word_attempt", bookTitle, searchTerm });
    const result = await gutenbergService.countWordInBook(bookTitle, searchTerm);
    logger.info({ event: "count_word_complete", bookTitle, searchTerm, count: result.count, success: result.success, durationMs: Date.now() - t0 });
    res.json(result);
  } catch (error) {
    logger.error({ event: "count_word_error", bookTitle: req.body?.bookTitle, searchTerm: req.body?.searchTerm, err: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/count-related", async (req, res) => {
  const t0 = Date.now();
  try {
    const { bookTitle, concept } = req.body;
    logger.info({ event: "count_related_attempt", bookTitle, concept });
    const result = await gutenbergService.countRelatedWordsInBook(bookTitle, concept);
    logger.info({ event: "count_related_complete", bookTitle, concept, relatedWordCount: result.relatedWords?.length, totalOccurrences: result.totalOccurrences, durationMs: Date.now() - t0 });
    res.json(result);
  } catch (error) {
    logger.error({ event: "count_related_error", bookTitle: req.body?.bookTitle, concept: req.body?.concept, err: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/text", async (req, res) => {
  const t0 = Date.now();
  try {
    const { bookTitle } = req.body;
    logger.info({ event: "text_fetch_attempt", bookTitle });
    const result = await gutenbergService.getBookFullText(bookTitle);
    logger.info({ event: "text_fetch_complete", bookTitle, success: result.success, textLength: result.text ? result.text.length : 0, durationMs: Date.now() - t0 });
    res.json(result);
  } catch (error) {
    logger.error({ event: "text_fetch_error", bookTitle: req.body?.bookTitle, err: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
