const Redis = require("ioredis");
const config = require("./appConfig");
const logger = require("./logger").child({ component: "redis" });

function createInMemoryStore() {
  const store = new Map();
  const listStore = new Map();
  const timers = new Map();

  function clearTimer(key) {
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
      timers.delete(key);
    }
  }

  function setTimer(key, ttlSeconds) {
    clearTimer(key);
    timers.set(
      key,
      setTimeout(() => {
        store.delete(key);
        listStore.delete(key);
        timers.delete(key);
      }, ttlSeconds * 1000),
    );
  }

  return {
    // String operations
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, exFlag, ttl) {
      store.set(key, value);
      if (exFlag === "EX" && ttl) setTimer(key, ttl);
      return "OK";
    },
    async del(key) {
      clearTimer(key);
      const deleted = store.delete(key) | listStore.delete(key);
      return deleted ? 1 : 0;
    },
    // List operations — used by RedisChatMessageHistory (lrange/rpush/expire)
    async lrange(key, start, stop) {
      const list = listStore.get(key) || [];
      const end = stop === -1 ? list.length : stop + 1;
      return list.slice(start < 0 ? Math.max(0, list.length + start) : start, end);
    },
    async rpush(key, ...values) {
      if (!listStore.has(key)) listStore.set(key, []);
      const list = listStore.get(key);
      list.push(...values);
      return list.length;
    },
    async lpush(key, ...values) {
      if (!listStore.has(key)) listStore.set(key, []);
      const list = listStore.get(key);
      list.unshift(...values);
      return list.length;
    },
    async expire(key, seconds) {
      if (!store.has(key) && !listStore.has(key)) return 0;
      setTimer(key, seconds);
      return 1;
    },
    async ltrim(key, start, stop) {
      const list = listStore.get(key) || [];
      const end = stop === -1 ? list.length : stop + 1;
      listStore.set(key, list.slice(start, end));
      return "OK";
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
  get client() { return redis; },
  get(key) { return redis.get(key); },
  set(key, value, exFlag, ttl) { return redis.set(key, value, exFlag, ttl); },
  del(key) { return redis.del(key); },
  lrange(key, start, stop) { return redis.lrange(key, start, stop); },
  rpush(key, ...values) { return redis.rpush(key, ...values); },
  lpush(key, ...values) { return redis.lpush(key, ...values); },
  expire(key, seconds) { return redis.expire(key, seconds); },
  ltrim(key, start, stop) { return redis.ltrim(key, start, stop); },
};
