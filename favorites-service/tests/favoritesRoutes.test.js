jest.mock("../models/Favorite");
jest.mock("../config/database", () => ({ connectDB: jest.fn() }));

const express = require("express");
const request = require("supertest");

const Favorite = require("../models/Favorite");
const favoritesRoutes = require("../routes/favoritesRoutes");

const app = express();
app.use(express.json());
app.use("/api/favorites", favoritesRoutes);

beforeEach(() => jest.clearAllMocks());

const VALID_ISBN = "9780140449136";
const INVALID_ISBN = "9780140449135";
const USER_ID = "user123";

// --- POST /api/favorites (add) ---

describe("POST /api/favorites", () => {
  test("returns 401 without x-user-id header", async () => {
    const res = await request(app).post("/api/favorites").send({ isbn13: VALID_ISBN, title: "Book" });
    expect(res.status).toBe(401);
  });

  test("rejects invalid ISBN-13", async () => {
    const res = await request(app)
      .post("/api/favorites")
      .set("x-user-id", USER_ID)
      .send({ isbn13: INVALID_ISBN, title: "Book" });
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid ISBN-13/);
  });

  test("returns alreadyExists when book is duplicate", async () => {
    Favorite.findOne.mockResolvedValue({ isbn: VALID_ISBN, title: "Book" });

    const res = await request(app)
      .post("/api/favorites")
      .set("x-user-id", USER_ID)
      .send({ isbn13: VALID_ISBN, title: "Book" });
    expect(res.body.success).toBe(false);
    expect(res.body.alreadyExists).toBe(true);
  });

  test("adds book successfully", async () => {
    Favorite.findOne.mockResolvedValue(null);
    Favorite.create.mockResolvedValue({
      isbn: VALID_ISBN,
      title: "Brothers K",
      addedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/favorites")
      .set("x-user-id", USER_ID)
      .send({ isbn13: VALID_ISBN, title: "Brothers K" });

    expect(res.body.success).toBe(true);
    expect(res.body.favorite.isbn).toBe(VALID_ISBN);
    expect(Favorite.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, isbn: VALID_ISBN, title: "Brothers K" }),
    );
  });

  test("returns 500 on DB error", async () => {
    Favorite.findOne.mockRejectedValue(new Error("DB down"));

    const res = await request(app)
      .post("/api/favorites")
      .set("x-user-id", USER_ID)
      .send({ isbn13: VALID_ISBN, title: "Book" });
    expect(res.status).toBe(500);
  });
});

// --- DELETE /api/favorites/:isbn ---

describe("DELETE /api/favorites/:isbn", () => {
  test("returns 401 without x-user-id header", async () => {
    const res = await request(app).delete(`/api/favorites/${VALID_ISBN}`);
    expect(res.status).toBe(401);
  });

  test("removes existing favorite", async () => {
    Favorite.findOneAndDelete.mockResolvedValue({
      isbn: VALID_ISBN,
      title: "Brothers K",
    });

    const res = await request(app)
      .delete(`/api/favorites/${VALID_ISBN}`)
      .set("x-user-id", USER_ID);

    expect(res.body.success).toBe(true);
    expect(res.body.removedBook.isbn).toBe(VALID_ISBN);
  });

  test("returns failure when ISBN not found", async () => {
    Favorite.findOneAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/favorites/${VALID_ISBN}`)
      .set("x-user-id", USER_ID);

    expect(res.body.success).toBe(false);
  });

  test("returns 500 on DB error", async () => {
    Favorite.findOneAndDelete.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .delete(`/api/favorites/${VALID_ISBN}`)
      .set("x-user-id", USER_ID);

    expect(res.status).toBe(500);
  });
});

// --- DELETE /api/favorites (clear all) ---

describe("DELETE /api/favorites", () => {
  test("returns 401 without x-user-id header", async () => {
    const res = await request(app).delete("/api/favorites");
    expect(res.status).toBe(401);
  });

  test("clears all favorites", async () => {
    Favorite.deleteMany.mockResolvedValue({ deletedCount: 3 });

    const res = await request(app)
      .delete("/api/favorites")
      .set("x-user-id", USER_ID);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/Cleared 3 books/);
  });

  test("returns already-empty message when none exist", async () => {
    Favorite.deleteMany.mockResolvedValue({ deletedCount: 0 });

    const res = await request(app)
      .delete("/api/favorites")
      .set("x-user-id", USER_ID);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/already empty/);
  });
});

// --- GET /api/favorites ---

describe("GET /api/favorites", () => {
  test("returns 401 without x-user-id header", async () => {
    const res = await request(app).get("/api/favorites");
    expect(res.status).toBe(401);
  });

  test("lists all favorites with count", async () => {
    const favorites = [
      { isbn: VALID_ISBN, title: "Book A", addedAt: new Date() },
      { isbn: "9780451524935", title: "Book B", addedAt: new Date() },
    ];
    Favorite.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(favorites) });

    const res = await request(app)
      .get("/api/favorites")
      .set("x-user-id", USER_ID);

    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.favorites).toHaveLength(2);
    expect(res.body.message).toMatch(/2 books/);
  });

  test("returns empty list message when no favorites", async () => {
    Favorite.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    const res = await request(app)
      .get("/api/favorites")
      .set("x-user-id", USER_ID);

    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(0);
    expect(res.body.message).toMatch(/empty/);
  });

  test("returns 500 on DB error", async () => {
    Favorite.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error("DB error")) });

    const res = await request(app)
      .get("/api/favorites")
      .set("x-user-id", USER_ID);

    expect(res.status).toBe(500);
  });
});
