const config = require("../config/appConfig");

const BASE = config.services.booksUrl;

async function resolveBookForSearch(bookTitle) {
  const res = await fetch(`${BASE}/api/books/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookTitle }),
  });
  return res.json();
}

async function countWordInBook(bookTitle, searchTerm) {
  const res = await fetch(`${BASE}/api/books/count-word`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookTitle, searchTerm }),
  });
  return res.json();
}

async function countRelatedWordsInBook(bookTitle, concept) {
  const res = await fetch(`${BASE}/api/books/count-related`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookTitle, concept }),
  });
  return res.json();
}

module.exports = {
  resolveBookForSearch,
  countWordInBook,
  countRelatedWordsInBook,
};
