/**
 * Favorite Service - Handles favorite books storage in MongoDB
 * Uses user's favorites array in the User document
 */

const User = require("../models/User");

/**
 * Validate ISBN-13 format
 * ISBN-13 must be exactly 13 digits
 * @param {string} isbn - ISBN to validate
 * @returns {boolean} - True if valid ISBN-13
 */
function isValidIsbn13(isbn) {
  if (!isbn || typeof isbn !== "string") {
    return false;
  }

  // Remove any hyphens or spaces
  const cleanIsbn = isbn.replace(/[-\s]/g, "");

  // Must be exactly 13 digits
  if (!/^\d{13}$/.test(cleanIsbn)) {
    return false;
  }

  // Validate ISBN-13 checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanIsbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === parseInt(cleanIsbn[12]);
}

/**
 * Normalize ISBN to ISBN-13 format (remove hyphens/spaces)
 * @param {string} isbn - ISBN to normalize
 * @returns {string} - Normalized ISBN-13
 */
function normalizeIsbn13(isbn) {
  if (!isbn || typeof isbn !== "string") {
    return "";
  }
  return isbn.replace(/[-\s]/g, "");
}

/**
 * Check if a book is already in favorites by ISBN-13
 * @param {string} userId - User's MongoDB ID
 * @param {string} isbn13 - ISBN-13 of the book
 * @returns {Promise<boolean>} - True if book is in favorites
 */
async function isFavorite(userId, isbn13) {
  const user = await User.findById(userId);
  if (!user) {
    return false;
  }
  return user.favorites.some((fav) => fav.isbn === isbn13);
}

/**
 * Add a book to favorites
 * @param {string} userId - User's MongoDB ID
 * @param {string} isbn13 - ISBN-13 of the book (must be ISBN-13 format)
 * @param {string} title - Title of the book
 * @returns {Promise<Object>} - { success: boolean, message: string, favorite?: Object }
 */
async function addFavorite(userId, isbn13, title) {
  // Validate ISBN-13 format
  if (!isValidIsbn13(isbn13)) {
    return {
      success: false,
      message: `Invalid ISBN-13 format: ${isbn13}. ISBN-13 must be exactly 13 digits.`,
    };
  }

  const user = await User.findById(userId);
  if (!user) {
    return {
      success: false,
      message: "User not found.",
    };
  }

  // Check for duplicates
  if (user.favorites.some((fav) => fav.isbn === isbn13)) {
    return {
      success: false,
      message: `"${title}" is already in your favorites list.`,
      alreadyExists: true,
    };
  }

  const favorite = {
    isbn: isbn13,
    title: title,
    addedAt: new Date(),
  };

  user.favorites.push(favorite);
  await user.save();

  return {
    success: true,
    message: `Added "${title}" to your favorites list.`,
    favorite: favorite,
  };
}

/**
 * Remove a book from favorites by ISBN-13
 * @param {string} userId - User's MongoDB ID
 * @param {string} isbn13 - ISBN-13 of the book to remove
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
async function removeFavorite(userId, isbn13) {
  const user = await User.findById(userId);
  if (!user) {
    return {
      success: false,
      message: "User not found.",
    };
  }

  const index = user.favorites.findIndex((fav) => fav.isbn === isbn13);

  if (index === -1) {
    return {
      success: false,
      message: `No book with ISBN ${isbn13} found in your favorites list.`,
    };
  }

  const removed = user.favorites.splice(index, 1)[0];
  await user.save();

  return {
    success: true,
    message: `Removed "${removed.title}" from your favorites list.`,
    removedBook: removed,
  };
}

/**
 * List all favorites
 * @param {string} userId - User's MongoDB ID
 * @returns {Promise<Object>} - { success: boolean, favorites: Array, count: number }
 */
async function listFavorites(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return {
      success: false,
      favorites: [],
      count: 0,
      message: "User not found.",
    };
  }

  return {
    success: true,
    favorites: user.favorites,
    count: user.favorites.length,
    message:
      user.favorites.length === 0
        ? "Your favorites list is empty."
        : `You have ${user.favorites.length} book${
            user.favorites.length === 1 ? "" : "s"
          } in your favorites list.`,
  };
}

/**
 * Get count of favorites
 * @param {string} userId - User's MongoDB ID
 * @returns {Promise<number>} - Number of favorites
 */
async function getFavoriteCount(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return 0;
  }
  return user.favorites.length;
}

/**
 * Clear all favorites
 * @param {string} userId - User's MongoDB ID
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
async function clearFavorites(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return {
      success: false,
      message: "User not found.",
    };
  }

  const count = user.favorites.length;
  user.favorites = [];
  await user.save();

  return {
    success: true,
    message:
      count === 0
        ? "Your favorites list was already empty."
        : `Cleared ${count} book${
            count === 1 ? "" : "s"
          } from your favorites list.`,
  };
}

module.exports = {
  isFavorite,
  addFavorite,
  removeFavorite,
  listFavorites,
  getFavoriteCount,
  clearFavorites,
  isValidIsbn13,
  normalizeIsbn13,
};
