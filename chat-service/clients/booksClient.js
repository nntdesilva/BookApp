const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "booksClient" });

const BASE = config.services.booksUrl;

async function resolveBookForSearch(bookTitle) {
  const url = `${BASE}/api/books/resolve`;
  logger.info({ event: "resolve_book_req", url, bookTitle });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookTitle }),
    });
    logger.info({ event: "resolve_book_res", httpStatus: res.status, bookTitle });
    return res.json();
  } catch (err) {
    logger.error({ event: "resolve_book_failed", url, bookTitle, err });
    throw err;
  }
}

async function countWordInBook(bookTitle, searchTerm) {
  const url = `${BASE}/api/books/count-word`;
  logger.info({ event: "count_word_req", url, bookTitle, searchTerm });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookTitle, searchTerm }),
    });
    logger.info({ event: "count_word_res", httpStatus: res.status, bookTitle, searchTerm });
    return res.json();
  } catch (err) {
    logger.error({ event: "count_word_failed", url, bookTitle, searchTerm, err });
    throw err;
  }
}

async function countRelatedWordsInBook(bookTitle, concept) {
  const url = `${BASE}/api/books/count-related`;
  logger.info({ event: "count_related_req", url, bookTitle, concept });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookTitle, concept }),
    });
    logger.info({ event: "count_related_res", httpStatus: res.status, bookTitle, concept });
    return res.json();
  } catch (err) {
    logger.error({ event: "count_related_failed", url, bookTitle, concept, err });
    throw err;
  }
}

module.exports = {
  resolveBookForSearch,
  countWordInBook,
  countRelatedWordsInBook,
};
