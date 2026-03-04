const config = require("../config/appConfig");

const BASE = config.services.analysisUrl;

async function analyzeBookStatistics(bookTitle, question) {
  const res = await fetch(`${BASE}/api/analysis/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookTitle, question }),
  });
  return res.json();
}

async function generateVisualization(bookTitle, question, chartType) {
  const res = await fetch(`${BASE}/api/analysis/visualize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookTitle, question, chartType }),
  });
  return res.json();
}

module.exports = {
  analyzeBookStatistics,
  generateVisualization,
};
