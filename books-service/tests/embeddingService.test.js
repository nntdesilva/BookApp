jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn(),
    },
  }));
});

jest.mock("../config/appConfig", () => ({
  embedding: {
    apiKey: "test-key",
    model: "text-embedding-3-large",
    similarityThreshold: 0.5,
    batchSize: 3,
  },
}));

const OpenAI = require("openai");
const { findRelatedWords } = require("../services/embeddingService");

let mockCreate;

beforeEach(() => {
  const instance = OpenAI.mock.results[0]?.value;
  if (instance) {
    mockCreate = instance.embeddings.create;
    mockCreate.mockReset();
  }
});

describe("findRelatedWords", () => {
  function vec(...components) {
    return components;
  }

  test("returns words above the similarity threshold sorted by similarity", async () => {
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.embeddings.create;

    mockCreate.mockResolvedValue({
      data: [
        { index: 0, embedding: vec(1, 0, 0) },
        { index: 1, embedding: vec(0.9, 0.1, 0) },
        { index: 2, embedding: vec(0, 1, 0) },
        { index: 3, embedding: vec(0.8, 0.2, 0) },
      ],
    });

    const result = await findRelatedWords(
      "flowers",
      ["rose", "car", "tulip"],
      0.5,
    );

    expect(result.length).toBe(2);
    expect(result[0].word).toBe("rose");
    expect(result[1].word).toBe("tulip");
    expect(result[0].similarity).toBeGreaterThanOrEqual(result[1].similarity);
  });

  test("returns empty array when no words meet threshold", async () => {
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.embeddings.create;

    mockCreate.mockResolvedValue({
      data: [
        { index: 0, embedding: vec(1, 0, 0) },
        { index: 1, embedding: vec(0, 1, 0) },
        { index: 2, embedding: vec(0, 0, 1) },
      ],
    });

    const result = await findRelatedWords("flowers", ["car", "truck"], 0.5);
    expect(result).toEqual([]);
  });

  test("handles empty uniqueWords array", async () => {
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.embeddings.create;

    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: vec(1, 0, 0) }],
    });

    const result = await findRelatedWords("flowers", [], 0.5);
    expect(result).toEqual([]);
  });

  test("rounds similarity to 3 decimal places", async () => {
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.embeddings.create;

    mockCreate.mockResolvedValue({
      data: [
        { index: 0, embedding: vec(1, 0, 0) },
        { index: 1, embedding: vec(0.99999, 0.001, 0) },
      ],
    });

    const result = await findRelatedWords("x", ["y"], 0);
    expect(result[0].similarity).toBe(
      Math.round(result[0].similarity * 1000) / 1000,
    );
  });

  test("batches large word lists according to batchSize config", async () => {
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.embeddings.create;

    const embeddings = Array.from({ length: 6 }, (_, i) => ({
      index: i % 3,
      embedding: vec(1, 0, 0),
    }));

    mockCreate.mockResolvedValue({
      data: embeddings.slice(0, 3),
    });

    const result = await findRelatedWords(
      "concept",
      ["a", "b", "c", "d", "e"],
      0,
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test("uses default threshold from config when not provided", async () => {
    const instance = OpenAI.mock.results[0].value;
    mockCreate = instance.embeddings.create;

    mockCreate.mockResolvedValue({
      data: [
        { index: 0, embedding: vec(1, 0) },
        { index: 1, embedding: vec(1, 0) },
      ],
    });

    const result = await findRelatedWords("concept", ["word"]);
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(1);
  });
});
