/**
 * Database Configuration
 * Handles MongoDB connection using Mongoose
 */

const mongoose = require("mongoose");

/**
 * Connect to MongoDB
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise} - Mongoose connection promise
 */
async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
}

/**
 * Handle connection events
 */
mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err);
});

module.exports = { connectDB };
