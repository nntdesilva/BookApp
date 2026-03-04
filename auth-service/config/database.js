const mongoose = require("mongoose");

async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    console.log("[auth-service] MongoDB connected");
  } catch (error) {
    console.error("[auth-service] MongoDB connection error:", error.message);
  }
}

mongoose.connection.on("disconnected", () => {
  console.log("[auth-service] MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("[auth-service] MongoDB error:", err);
});

module.exports = { connectDB };
