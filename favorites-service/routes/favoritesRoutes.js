const express = require("express");
const Favorite = require("../models/Favorite");

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
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const { isbn13, title } = req.body;
    const normalizedIsbn = normalizeIsbn13(isbn13);

    if (!isValidIsbn13(normalizedIsbn)) {
      return res.json({
        success: false,
        message: `Invalid ISBN-13 format: ${isbn13}. ISBN-13 must be exactly 13 digits.`,
      });
    }

    const existing = await Favorite.findOne({ userId, isbn: normalizedIsbn });
    if (existing) {
      return res.json({
        success: false,
        message: `"${title}" is already in your favorites list.`,
        alreadyExists: true,
      });
    }

    const favorite = await Favorite.create({
      userId,
      isbn: normalizedIsbn,
      title,
    });

    res.json({
      success: true,
      message: `Added "${title}" to your favorites list.`,
      favorite: { isbn: favorite.isbn, title: favorite.title, addedAt: favorite.addedAt },
    });
  } catch (error) {
    console.error("[favorites-service] Add error:", error);
    res.status(500).json({ success: false, message: "Failed to add favorite" });
  }
});

router.delete("/:isbn", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const isbn = normalizeIsbn13(req.params.isbn);
    const removed = await Favorite.findOneAndDelete({ userId, isbn });

    if (!removed) {
      return res.json({
        success: false,
        message: `No book with ISBN ${isbn} found in your favorites list.`,
      });
    }

    res.json({
      success: true,
      message: `Removed "${removed.title}" from your favorites list.`,
      removedBook: { isbn: removed.isbn, title: removed.title },
    });
  } catch (error) {
    console.error("[favorites-service] Remove error:", error);
    res.status(500).json({ success: false, message: "Failed to remove favorite" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const result = await Favorite.deleteMany({ userId });
    const count = result.deletedCount;

    res.json({
      success: true,
      message: count === 0
        ? "Your favorites list was already empty."
        : `Cleared ${count} book${count === 1 ? "" : "s"} from your favorites list.`,
    });
  } catch (error) {
    console.error("[favorites-service] Clear error:", error);
    res.status(500).json({ success: false, message: "Failed to clear favorites" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const favorites = await Favorite.find({ userId }).sort({ addedAt: -1 });

    res.json({
      success: true,
      favorites: favorites.map((f) => ({ isbn: f.isbn, title: f.title, addedAt: f.addedAt })),
      count: favorites.length,
      message: favorites.length === 0
        ? "Your favorites list is empty."
        : `You have ${favorites.length} book${favorites.length === 1 ? "" : "s"} in your favorites list.`,
    });
  } catch (error) {
    console.error("[favorites-service] List error:", error);
    res.status(500).json({ success: false, message: "Failed to list favorites" });
  }
});

module.exports = router;
