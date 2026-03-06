const express = require("express");
const analysisService = require("../services/analysisService");
const Redis = require("ioredis");
const config = require("../config/appConfig");

const router = express.Router();

let redis = null;

const _redisClient = new Redis(config.redis.url, {
  enableOfflineQueue: false,
  retryStrategy: () => null,
});

_redisClient.on("ready", () => {
  redis = _redisClient;
  console.log("[analysis-service] Redis connected, caching enabled");
});

_redisClient.on("error", () => {
  redis = null;
});

router.post("/analyze", async (req, res) => {
  try {
    const { bookTitle, question } = req.body;
    const result = await analysisService.analyzeBookStatistics(bookTitle, question);
    res.json(result);
  } catch (error) {
    console.error("[analysis-service] Analyze error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/visualize", async (req, res) => {
  try {
    const { bookTitle, question, chartType } = req.body;

    const cacheKey = `viz:${(bookTitle || "").toLowerCase().trim()}::${(question || "").toLowerCase().trim()}`;

    let analysisResult;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        analysisResult = JSON.parse(cached);
      }
    }

    if (!analysisResult) {
      analysisResult = await analysisService.analyzeBookStatistics(bookTitle, question);
      if (analysisResult.success && redis) {
        await redis.set(cacheKey, JSON.stringify(analysisResult), "EX", 3600);
      }
    }

    if (!analysisResult.success) {
      return res.json(analysisResult);
    }

    const result = await analysisService.generateVisualization(
      analysisResult.answer,
      analysisResult.bookTitle,
      analysisResult.authors,
      chartType,
    );
    res.json(result);
  } catch (error) {
    console.error("[analysis-service] Visualize error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
