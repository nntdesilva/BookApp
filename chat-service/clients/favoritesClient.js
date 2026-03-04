const config = require("../config/appConfig");

const BASE = config.services.favoritesUrl;

function normalizeIsbn13(isbn) {
  if (!isbn || typeof isbn !== "string") return "";
  return isbn.replace(/[-\s]/g, "");
}

async function addFavorite(userId, isbn13, title) {
  const res = await fetch(`${BASE}/api/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body: JSON.stringify({ isbn13: normalizeIsbn13(isbn13), title }),
  });
  return res.json();
}

async function removeFavorite(userId, isbn13) {
  const isbn = normalizeIsbn13(isbn13);
  const res = await fetch(`${BASE}/api/favorites/${isbn}`, {
    method: "DELETE",
    headers: { "x-user-id": userId },
  });
  return res.json();
}

async function listFavorites(userId) {
  const res = await fetch(`${BASE}/api/favorites`, {
    headers: { "x-user-id": userId },
  });
  return res.json();
}

async function clearFavorites(userId) {
  const res = await fetch(`${BASE}/api/favorites`, {
    method: "DELETE",
    headers: { "x-user-id": userId },
  });
  return res.json();
}

module.exports = {
  addFavorite,
  removeFavorite,
  listFavorites,
  clearFavorites,
  normalizeIsbn13,
};
