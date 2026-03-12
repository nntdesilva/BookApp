const express = require("express");
const Favorite = require("../models/Favorite");
const logger = require("../config/logger").child({ component: "favoritesRoutes" });

const router = express.Router();

function isValidIsbn13(isbn) {
  if (!isbn || typeof isbn !== "string") return false;
  const clean = isbn.replace(/[-\s]/g, "");
  if (!/^\d{13}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10 === parseInt(clean[12]);
}

function normalizeIsbn13(isbn) {
  if (!isbn || typeof isbn !== "string") return "";
  return isbn.replace(/[-\s]/g, "");
}

router.post("/", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      logger.warn({ event: "add_rejected", reason: "missing_user_id" });
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { isbn13, title } = req.body;
    const normalizedIsbn = normalizeIsbn13(isbn13);

    logger.info({ event: "add_attempt", userId, isbn13: normalizedIsbn, title });

    if (!isValidIsbn13(normalizedIsbn)) {
      logger.warn({ event: "add_rejected", reason: "invalid_isbn13", isbn13, userId });
      return res.json({
        success: false,
        message: `Invalid ISBN-13 format: ${isbn13}. ISBN-13 must be exactly 13 digits.`,
      });
    }

    const existing = await Favorite.findOne({ userId, isbn: normalizedIsbn });
    if (existing) {
      logger.info({ event: "add_skipped", reason: "already_exists", isbn13: normalizedIsbn, title, userId });
      return res.json({
        success: false,
        message: `"${title}" is already in your favorites list.`,
        alreadyExists: true,
      });
    }

    const favorite = await Favorite.create({ userId, isbn: normalizedIsbn, title });

    logger.info({ event: "add_success", isbn13: favorite.isbn, title: favorite.title, userId });
    res.json({
      success: true,
      message: `Added "${title}" to your favorites list.`,
      favorite: { isbn: favorite.isbn, title: favorite.title, addedAt: favorite.addedAt },
    });
  } catch (error) {
    logger.error({ event: "add_error", userId: req.headers["x-user-id"], isbn13: req.body?.isbn13, err: error });
    res.status(500).json({ success: false, message: "Failed to add favorite" });
  }
});

router.delete("/:isbn", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      logger.warn({ event: "remove_rejected", reason: "missing_user_id" });
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const isbn = normalizeIsbn13(req.params.isbn);
    logger.info({ event: "remove_attempt", isbn, userId });

    const removed = await Favorite.findOneAndDelete({ userId, isbn });

    if (!removed) {
      logger.warn({ event: "remove_skipped", reason: "not_found", isbn, userId });
      return res.json({
        success: false,
        message: `No book with ISBN ${isbn} found in your favorites list.`,
      });
    }

    logger.info({ event: "remove_success", isbn: removed.isbn, title: removed.title, userId });
    res.json({
      success: true,
      message: `Removed "${removed.title}" from your favorites list.`,
      removedBook: { isbn: removed.isbn, title: removed.title },
    });
  } catch (error) {
    logger.error({ event: "remove_error", userId: req.headers["x-user-id"], isbn: req.params.isbn, err: error });
    res.status(500).json({ success: false, message: "Failed to remove favorite" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      logger.warn({ event: "clear_rejected", reason: "missing_user_id" });
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    logger.info({ event: "clear_attempt", userId });
    const result = await Favorite.deleteMany({ userId });
    const count = result.deletedCount;

    logger.info({ event: "clear_success", userId, deletedCount: count });
    res.json({
      success: true,
      message: count === 0
        ? "Your favorites list was already empty."
        : `Cleared ${count} book${count === 1 ? "" : "s"} from your favorites list.`,
    });
  } catch (error) {
    logger.error({ event: "clear_error", userId: req.headers["x-user-id"], err: error });
    res.status(500).json({ success: false, message: "Failed to clear favorites" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      logger.warn({ event: "list_rejected", reason: "missing_user_id" });
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    logger.info({ event: "list_attempt", userId });
    const favorites = await Favorite.find({ userId }).sort({ addedAt: -1 });

    logger.info({ event: "list_success", userId, count: favorites.length });
    res.json({
      success: true,
      favorites: favorites.map((f) => ({ isbn: f.isbn, title: f.title, addedAt: f.addedAt })),
      count: favorites.length,
      message: favorites.length === 0
        ? "Your favorites list is empty."
        : `You have ${favorites.length} book${favorites.length === 1 ? "" : "s"} in your favorites list.`,
    });
  } catch (error) {
    logger.error({ event: "list_error", userId: req.headers["x-user-id"], err: error });
    res.status(500).json({ success: false, message: "Failed to list favorites" });
  }
});

module.exports = router;
