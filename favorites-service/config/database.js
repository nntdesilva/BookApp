const mongoose = require("mongoose");

async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    console.log("[favorites-service] MongoDB connected");
  } catch (error) {
    console.error("[favorites-service] MongoDB connection error:", error.message);
  }
}

mongoose.connection.on("disconnected", () => {
  console.log("[favorites-service] MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("[favorites-service] MongoDB error:", err);
});

module.exports = { connectDB };
