const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "analysisClient" });

const BASE = config.services.analysisUrl;

async function analyzeBookStatistics(bookTitle, question) {
  const url = `${BASE}/api/analysis/analyze`;
  logger.info({ event: "analyze_stats_req", url, bookTitle, questionLength: question ? question.length : 0 });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookTitle, question }),
    });
    logger.info({ event: "analyze_stats_res", httpStatus: res.status, bookTitle });
    return res.json();
  } catch (err) {
    logger.error({ event: "analyze_stats_failed", url, bookTitle, err });
    throw err;
  }
}

async function generateVisualization(bookTitle, question, chartType) {
  const url = `${BASE}/api/analysis/visualize`;
  logger.info({ event: "generate_viz_req", url, bookTitle, chartType });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookTitle, question, chartType }),
    });
    logger.info({ event: "generate_viz_res", httpStatus: res.status, bookTitle, chartType });
    return res.json();
  } catch (err) {
    logger.error({ event: "generate_viz_failed", url, bookTitle, chartType, err });
    throw err;
  }
}

module.exports = {
  analyzeBookStatistics,
  generateVisualization,
};
