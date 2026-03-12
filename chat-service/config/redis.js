const Redis = require("ioredis");
const config = require("./appConfig");
const logger = require("./logger").child({ component: "redis" });

function createInMemoryStore() {
  const store = new Map();
  const timers = new Map();

  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, exFlag, ttl) {
      store.set(key, value);
      if (exFlag === "EX" && ttl) {
        if (timers.has(key)) clearTimeout(timers.get(key));
        timers.set(key, setTimeout(() => store.delete(key), ttl * 1000));
      }
      return "OK";
    },
    async del(key) {
      if (timers.has(key)) clearTimeout(timers.get(key));
      return store.delete(key) ? 1 : 0;
    },
  };
}

let redis = createInMemoryStore();

const client = new Redis(config.redis.url, { lazyConnect: true, enableOfflineQueue: false });

client.on("connect", () => {
  logger.info({ event: "redis_connected" });
  redis = client;
});

client.on("error", (err) => {
  if (redis === client) {
    logger.warn({ event: "redis_error_fallback", err, msg: "falling back to in-memory store" });
    redis = createInMemoryStore();
  }
});

client.connect().catch((err) => {
  logger.warn({ event: "redis_unavailable", err, msg: "using in-memory store" });
});

module.exports = {
  get client() {
    return redis;
  },
  get(key) { return redis.get(key); },
  set(key, value, exFlag, ttl) { return redis.set(key, value, exFlag, ttl); },
  del(key) { return redis.del(key); },
};
