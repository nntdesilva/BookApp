/**
 * Input Validators
 * Common validation functions used across the application
 */

/**
 * Validate that a message is not empty
 * @param {string} message - Message to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateMessage(message) {
  if (!message) {
    return { valid: false, error: "Message is required" };
  }

  if (typeof message !== "string") {
    return { valid: false, error: "Message must be a string" };
  }

  if (message.trim() === "") {
    return { valid: false, error: "Message cannot be empty" };
  }

  if (message.length > 5000) {
    return { valid: false, error: "Message is too long (max 5000 characters)" };
  }

  return { valid: true };
}

/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== "string") {
    return "";
  }

  // Basic sanitization - replace potentially dangerous characters
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate environment variables are set
 * @param {Array<string>} requiredVars - Array of required environment variable names
 * @returns {Object} - { valid: boolean, missing: Array<string> }
 */
function validateEnvironment(requiredVars) {
  const missing = [];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate ISBN-13 format
 * ISBN-13 must be exactly 13 digits with valid checksum
 * @param {string} isbn - ISBN to validate
 * @returns {Object} - { valid: boolean, error?: string, normalizedIsbn?: string }
 */
function validateIsbn13(isbn) {
  if (!isbn || typeof isbn !== "string") {
    return { valid: false, error: "ISBN is required" };
  }

  // Remove any hyphens or spaces
  const cleanIsbn = isbn.replace(/[-\s]/g, "");

  // Must be exactly 13 digits
  if (!/^\d{13}$/.test(cleanIsbn)) {
    return {
      valid: false,
      error: "ISBN-13 must be exactly 13 digits",
    };
  }

  // Validate ISBN-13 checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanIsbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  if (checkDigit !== parseInt(cleanIsbn[12])) {
    return {
      valid: false,
      error: "Invalid ISBN-13 checksum",
    };
  }

  return {
    valid: true,
    normalizedIsbn: cleanIsbn,
  };
}

/**
 * Validate favorite book data
 * @param {Object} bookData - Book data with isbn13 and title
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateFavoriteBook(bookData) {
  if (!bookData || typeof bookData !== "object") {
    return { valid: false, error: "Book data is required" };
  }

  const { isbn13, title } = bookData;

  // Validate ISBN-13
  const isbnValidation = validateIsbn13(isbn13);
  if (!isbnValidation.valid) {
    return isbnValidation;
  }

  // Validate title
  if (!title || typeof title !== "string") {
    return { valid: false, error: "Book title is required" };
  }

  if (title.trim() === "") {
    return { valid: false, error: "Book title cannot be empty" };
  }

  if (title.length > 500) {
    return {
      valid: false,
      error: "Book title is too long (max 500 characters)",
    };
  }

  return { valid: true };
}

module.exports = {
  validateMessage,
  sanitizeInput,
  validateEnvironment,
  validateIsbn13,
  validateFavoriteBook,
};
