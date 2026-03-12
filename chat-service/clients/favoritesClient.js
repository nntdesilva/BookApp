const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "favoritesClient" });

const BASE = config.services.favoritesUrl;

function normalizeIsbn13(isbn) {
  if (!isbn || typeof isbn !== "string") return "";
  return isbn.replace(/[-\s]/g, "");
}

async function addFavorite(userId, isbn13, title) {
  const url = `${BASE}/api/favorites`;
  const normalizedIsbn = normalizeIsbn13(isbn13);
  logger.info({ event: "add_favorite_req", url, userId, isbn13: normalizedIsbn, title });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ isbn13: normalizedIsbn, title }),
    });
    logger.info({ event: "add_favorite_res", httpStatus: res.status, userId, isbn13: normalizedIsbn });
    return res.json();
  } catch (err) {
    logger.error({ event: "add_favorite_failed", url, userId, isbn13: normalizedIsbn, err });
    throw err;
  }
}

async function removeFavorite(userId, isbn13) {
  const isbn = normalizeIsbn13(isbn13);
  const url = `${BASE}/api/favorites/${isbn}`;
  logger.info({ event: "remove_favorite_req", url, userId, isbn });
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "x-user-id": userId },
    });
    logger.info({ event: "remove_favorite_res", httpStatus: res.status, userId, isbn });
    return res.json();
  } catch (err) {
    logger.error({ event: "remove_favorite_failed", url, userId, isbn, err });
    throw err;
  }
}

async function listFavorites(userId) {
  const url = `${BASE}/api/favorites`;
  logger.info({ event: "list_favorites_req", url, userId });
  try {
    const res = await fetch(url, {
      headers: { "x-user-id": userId },
    });
    logger.info({ event: "list_favorites_res", httpStatus: res.status, userId });
    return res.json();
  } catch (err) {
    logger.error({ event: "list_favorites_failed", url, userId, err });
    throw err;
  }
}

async function clearFavorites(userId) {
  const url = `${BASE}/api/favorites`;
  logger.info({ event: "clear_favorites_req", url, userId });
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "x-user-id": userId },
    });
    logger.info({ event: "clear_favorites_res", httpStatus: res.status, userId });
    return res.json();
  } catch (err) {
    logger.error({ event: "clear_favorites_failed", url, userId, err });
    throw err;
  }
}

module.exports = {
  addFavorite,
  removeFavorite,
  listFavorites,
  clearFavorites,
  normalizeIsbn13,
};
