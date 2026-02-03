/**
 * Favorite Service - Handles favorite books storage in session
 * Uses session-based storage with future MongoDB migration in mind
 */

/**
 * Initialize favorites array in session if not exists
 * @param {Object} session - Express session object
 * @returns {Array} - Favorites array
 */
function initializeFavorites(session) {
  if (!session.favorites) {
    session.favorites = [];
  }
  return session.favorites;
}

/**
 * Check if a book is already in favorites by ISBN-13
 * @param {Object} session - Express session object
 * @param {string} isbn13 - ISBN-13 of the book
 * @returns {boolean} - True if book is in favorites
 */
function isFavorite(session, isbn13) {
  initializeFavorites(session);
  return session.favorites.some((fav) => fav.isbn === isbn13);
}

/**
 * Add a book to favorites
 * @param {Object} session - Express session object
 * @param {string} isbn13 - ISBN-13 of the book (must be ISBN-13 format)
 * @param {string} title - Title of the book
 * @returns {Object} - { success: boolean, message: string, favorite?: Object }
 */
function addFavorite(session, isbn13, title) {
  initializeFavorites(session);

  // Validate ISBN-13 format
  if (!isValidIsbn13(isbn13)) {
    return {
      success: false,
      message: `Invalid ISBN-13 format: ${isbn13}. ISBN-13 must be exactly 13 digits.`,
    };
  }

  // Check for duplicates
  if (isFavorite(session, isbn13)) {
    return {
      success: false,
      message: `"${title}" is already in your favorites list.`,
      alreadyExists: true,
    };
  }

  const favorite = {
    isbn: isbn13,
    title: title,
    addedAt: new Date().toISOString(),
  };

  session.favorites.push(favorite);

  return {
    success: true,
    message: `Added "${title}" to your favorites list.`,
    favorite: favorite,
  };
}

/**
 * Remove a book from favorites by ISBN-13
 * @param {Object} session - Express session object
 * @param {string} isbn13 - ISBN-13 of the book to remove
 * @returns {Object} - { success: boolean, message: string }
 */
function removeFavorite(session, isbn13) {
  initializeFavorites(session);

  const index = session.favorites.findIndex((fav) => fav.isbn === isbn13);

  if (index === -1) {
    return {
      success: false,
      message: `No book with ISBN ${isbn13} found in your favorites list.`,
    };
  }

  const removed = session.favorites.splice(index, 1)[0];

  return {
    success: true,
    message: `Removed "${removed.title}" from your favorites list.`,
    removedBook: removed,
  };
}

/**
 * List all favorites
 * @param {Object} session - Express session object
 * @returns {Object} - { success: boolean, favorites: Array, count: number }
 */
function listFavorites(session) {
  initializeFavorites(session);

  return {
    success: true,
    favorites: session.favorites,
    count: session.favorites.length,
    message:
      session.favorites.length === 0
        ? "Your favorites list is empty."
        : `You have ${session.favorites.length} book${
            session.favorites.length === 1 ? "" : "s"
          } in your favorites list.`,
  };
}

/**
 * Get count of favorites
 * @param {Object} session - Express session object
 * @returns {number} - Number of favorites
 */
function getFavoriteCount(session) {
  initializeFavorites(session);
  return session.favorites.length;
}

/**
 * Clear all favorites
 * @param {Object} session - Express session object
 * @returns {Object} - { success: boolean, message: string }
 */
function clearFavorites(session) {
  const count = getFavoriteCount(session);
  session.favorites = [];

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

module.exports = {
  initializeFavorites,
  isFavorite,
  addFavorite,
  removeFavorite,
  listFavorites,
  getFavoriteCount,
  clearFavorites,
  isValidIsbn13,
  normalizeIsbn13,
};
