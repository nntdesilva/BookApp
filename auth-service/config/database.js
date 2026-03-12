const mongoose = require("mongoose");
const logger = require("./logger").child({ component: "database" });

async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    logger.info({ event: "mongodb_connected" });
  } catch (error) {
    logger.error({ event: "mongodb_connection_error", err: error });
  }
}

mongoose.connection.on("disconnected", () => {
  logger.warn({ event: "mongodb_disconnected" });
});

mongoose.connection.on("error", (err) => {
  logger.error({ event: "mongodb_error", err });
});

module.exports = { connectDB };
