const express = require("express");
const analysisService = require("../services/analysisService");
const Redis = require("ioredis");
const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "analysisRoutes" });

const router = express.Router();

let redis = null;

const _redisClient = new Redis(config.redis.url, {
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: () => null,
});

_redisClient.on("ready", () => {
  redis = _redisClient;
  logger.info({ event: "redis_connected", msg: "caching enabled" });
});

_redisClient.on("error", () => {
  redis = null;
});

_redisClient.connect().catch(() => {
  // Redis unavailable - caching disabled, service runs without it
});

router.post("/analyze", async (req, res) => {
  const t0 = Date.now();
  try {
    const { bookTitle, question } = req.body;
    logger.info({ event: "analyze_attempt", bookTitle, questionLength: question ? question.length : 0 });
    const result = await analysisService.analyzeBookStatistics(bookTitle, question);
    logger.info({ event: "analyze_complete", bookTitle, success: result.success, answerLength: result.answer ? result.answer.length : 0, durationMs: Date.now() - t0 });
    res.json(result);
  } catch (error) {
    logger.error({ event: "analyze_error", bookTitle: req.body?.bookTitle, durationMs: Date.now() - t0, err: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/visualize", async (req, res) => {
  const t0 = Date.now();
  try {
    const { bookTitle, question, chartType } = req.body;
    logger.info({ event: "visualize_attempt", bookTitle, chartType, questionLength: question ? question.length : 0 });

    const cacheKey = `viz:${(bookTitle || "").toLowerCase().trim()}::${(question || "").toLowerCase().trim()}`;

    let analysisResult;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        analysisResult = JSON.parse(cached);
        logger.info({ event: "analysis_cache_hit", bookTitle, cacheKey });
      }
    } else {
      logger.warn({ event: "redis_unavailable", msg: "analysis cache disabled" });
    }

    if (!analysisResult) {
      logger.info({ event: "analysis_cache_miss", bookTitle });
      analysisResult = await analysisService.analyzeBookStatistics(bookTitle, question);
      if (analysisResult.success && redis) {
        await redis.set(cacheKey, JSON.stringify(analysisResult), "EX", 3600);
        logger.info({ event: "analysis_cached", bookTitle, ttl: 3600 });
      }
    }

    if (!analysisResult.success) {
      logger.warn({ event: "visualize_aborted", reason: "analysis_failed", bookTitle, error: analysisResult.error });
      return res.json(analysisResult);
    }

    const result = await analysisService.generateVisualization(
      analysisResult.answer,
      analysisResult.bookTitle,
      analysisResult.authors,
      chartType,
    );
    logger.info({ event: "visualize_complete", bookTitle, chartType, success: result.success, htmlLength: result.html ? result.html.length : 0, durationMs: Date.now() - t0 });
    res.json(result);
  } catch (error) {
    logger.error({ event: "visualize_error", bookTitle: req.body?.bookTitle, durationMs: Date.now() - t0, err: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
