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

module.exports = {
  validateMessage,
  sanitizeInput,
  validateEnvironment,
};
