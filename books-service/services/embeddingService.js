/**
 * Embedding Service - Handles OpenAI embedding operations for semantic word search
 * Uses OpenAI's text-embedding API exclusively for generating word embeddings.
 * All other AI features use Claude (Anthropic).
 */

const OpenAI = require("openai");
const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "embeddingService" });

const openai = config.embedding.apiKey
  ? new OpenAI({ apiKey: config.embedding.apiKey })
  : null;

/**
 * Generate embeddings for an array of texts using OpenAI's embedding API
 * Handles batching automatically for large arrays
 * @param {string[]} texts - Array of strings to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
  const batchSize = config.embedding.batchSize;
  const allEmbeddings = [];
  const totalBatches = Math.ceil(texts.length / batchSize);

  logger.info({ event: "embeddings_start", totalTexts: texts.length, batchSize, totalBatches, model: config.embedding.model });
  const t0 = Date.now();

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    const response = await openai.embeddings.create({
      model: config.embedding.model,
      input: batch,
    });

    // Sort by index to preserve order, then extract embedding vectors
    const sorted = response.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      allEmbeddings.push(item.embedding);
    }

    if (totalBatches > 1) {
      logger.info({ event: "embeddings_batch_complete", batch: batchNum, totalBatches, tokens: response.usage?.total_tokens });
    }
  }

  logger.info({ event: "embeddings_complete", total: allEmbeddings.length, durationMs: Date.now() - t0 });
  return allEmbeddings;
}

/**
 * Compute cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Cosine similarity (-1 to 1)
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find words semantically related to a concept from a list of unique words
 * Uses embeddings and cosine similarity to identify related words
 * @param {string} concept - The concept to find related words for (e.g., "flowers")
 * @param {string[]} uniqueWords - Array of unique words from the book
 * @param {number} [threshold] - Cosine similarity threshold (defaults to config value)
 * @returns {Promise<Object[]>} - Array of { word, similarity } objects, sorted by similarity desc
 */
async function findRelatedWords(concept, uniqueWords, threshold) {
  const similarityThreshold =
    threshold !== undefined ? threshold : config.embedding.similarityThreshold;

  logger.info({ event: "find_related_words_start", concept, uniqueWordCount: uniqueWords.length, threshold: similarityThreshold });
  const t0 = Date.now();

  // Embed the concept and all unique words together
  // Put concept first, then all words — single batch pipeline
  const textsToEmbed = [concept, ...uniqueWords];
  const embeddings = await generateEmbeddings(textsToEmbed);

  // First embedding is the concept, rest are words
  const conceptEmbedding = embeddings[0];
  const wordEmbeddings = embeddings.slice(1);

  // Compute similarity for each word against the concept
  const relatedWords = [];

  for (let i = 0; i < uniqueWords.length; i++) {
    const similarity = cosineSimilarity(conceptEmbedding, wordEmbeddings[i]);

    if (similarity >= similarityThreshold) {
      relatedWords.push({
        word: uniqueWords[i],
        similarity: Math.round(similarity * 1000) / 1000, // round to 3 decimals
      });
    }
  }

  // Sort by similarity descending
  relatedWords.sort((a, b) => b.similarity - a.similarity);

  logger.info({ event: "find_related_words_complete", concept, relatedWords: relatedWords.length, durationMs: Date.now() - t0 });
  return relatedWords;
}

module.exports = {
  findRelatedWords,
};
