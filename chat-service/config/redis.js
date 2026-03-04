const Redis = require("ioredis");
const config = require("./appConfig");

let redis;
try {
  redis = new Redis(config.redis.url);
  redis.on("error", (err) => {
    console.error("[chat-service] Redis error:", err.message);
  });
  redis.on("connect", () => {
    console.log("[chat-service] Redis connected");
  });
} catch (err) {
  console.error("[chat-service] Failed to create Redis client:", err.message);
}

module.exports = redis;
