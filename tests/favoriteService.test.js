const User = require("../models/User");

jest.mock("../models/User");

const {
  isValidIsbn13,
  normalizeIsbn13,
  isFavorite,
  addFavorite,
  removeFavorite,
  listFavorites,
  getFavoriteCount,
  clearFavorites,
} = require("../services/favoriteService");

// --- Pure helper functions (no DB) ---

describe("isValidIsbn13", () => {
  test("returns true for a valid ISBN-13", () => {
    expect(isValidIsbn13("9780140449136")).toBe(true);
  });

  test("strips hyphens before validating", () => {
    expect(isValidIsbn13("978-0-14-044913-6")).toBe(true);
  });

  test("strips spaces before validating", () => {
    expect(isValidIsbn13("978 0140449136")).toBe(true);
  });

  test("returns false for invalid checksum", () => {
    expect(isValidIsbn13("9780140449135")).toBe(false);
  });

  test("returns false for wrong length", () => {
    expect(isValidIsbn13("978014")).toBe(false);
    expect(isValidIsbn13("97801404491361234")).toBe(false);
  });

  test("returns false for non-digit characters", () => {
    expect(isValidIsbn13("978014044913X")).toBe(false);
  });

  test("returns false for null / undefined / non-string", () => {
    expect(isValidIsbn13(null)).toBe(false);
    expect(isValidIsbn13(undefined)).toBe(false);
    expect(isValidIsbn13(9780140449136)).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidIsbn13("")).toBe(false);
  });
});

describe("normalizeIsbn13", () => {
  test("removes hyphens", () => {
    expect(normalizeIsbn13("978-0-14-044913-6")).toBe("9780140449136");
  });

  test("removes spaces", () => {
    expect(normalizeIsbn13("978 0 140449136")).toBe("9780140449136");
  });

  test("returns empty string for null / undefined", () => {
    expect(normalizeIsbn13(null)).toBe("");
    expect(normalizeIsbn13(undefined)).toBe("");
  });

  test("returns empty string for non-string", () => {
    expect(normalizeIsbn13(123)).toBe("");
  });
});

// --- DB-backed functions (mocked User model) ---

function mockUser(favorites = []) {
  return {
    _id: "user123",
    favorites: [...favorites],
    save: jest.fn().mockResolvedValue(true),
  };
}

describe("isFavorite", () => {
  afterEach(() => jest.restoreAllMocks());

  test("returns true when book exists in favorites", async () => {
    User.findById.mockResolvedValue(
      mockUser([{ isbn: "9780140449136", title: "Brothers K" }]),
    );
    expect(await isFavorite("user123", "9780140449136")).toBe(true);
  });

  test("returns false when book is not in favorites", async () => {
    User.findById.mockResolvedValue(mockUser([]));
    expect(await isFavorite("user123", "9780140449136")).toBe(false);
  });

  test("returns false when user not found", async () => {
    User.findById.mockResolvedValue(null);
    expect(await isFavorite("nouser", "9780140449136")).toBe(false);
  });
});

describe("addFavorite", () => {
  afterEach(() => jest.restoreAllMocks());

  test("adds book successfully", async () => {
    const user = mockUser([]);
    User.findById.mockResolvedValue(user);

    const result = await addFavorite("user123", "9780140449136", "Brothers K");
    expect(result.success).toBe(true);
    expect(result.favorite.isbn).toBe("9780140449136");
    expect(user.save).toHaveBeenCalled();
  });

  test("rejects invalid ISBN-13", async () => {
    const result = await addFavorite("user123", "9780140449135", "Bad");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Invalid ISBN-13/);
  });

  test("rejects duplicate", async () => {
    User.findById.mockResolvedValue(
      mockUser([{ isbn: "9780140449136", title: "Brothers K" }]),
    );
    const result = await addFavorite("user123", "9780140449136", "Brothers K");
    expect(result.success).toBe(false);
    expect(result.alreadyExists).toBe(true);
  });

  test("handles user not found", async () => {
    User.findById.mockResolvedValue(null);
    const result = await addFavorite("nouser", "9780140449136", "Book");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/User not found/);
  });
});

describe("removeFavorite", () => {
  afterEach(() => jest.restoreAllMocks());

  test("removes existing favorite", async () => {
    const user = mockUser([{ isbn: "9780140449136", title: "Brothers K" }]);
    User.findById.mockResolvedValue(user);

    const result = await removeFavorite("user123", "9780140449136");
    expect(result.success).toBe(true);
    expect(result.removedBook.isbn).toBe("9780140449136");
    expect(user.save).toHaveBeenCalled();
  });

  test("returns failure when ISBN not in favorites", async () => {
    User.findById.mockResolvedValue(mockUser([]));
    const result = await removeFavorite("user123", "9780140449136");
    expect(result.success).toBe(false);
  });

  test("handles user not found", async () => {
    User.findById.mockResolvedValue(null);
    const result = await removeFavorite("nouser", "9780140449136");
    expect(result.success).toBe(false);
  });
});

describe("listFavorites", () => {
  afterEach(() => jest.restoreAllMocks());

  test("lists all favorites", async () => {
    User.findById.mockResolvedValue(
      mockUser([
        { isbn: "9780140449136", title: "A" },
        { isbn: "9780451524935", title: "B" },
      ]),
    );
    const result = await listFavorites("user123");
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.message).toMatch(/2 books/);
  });

  test("returns empty list message", async () => {
    User.findById.mockResolvedValue(mockUser([]));
    const result = await listFavorites("user123");
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toMatch(/empty/);
  });

  test("singular 'book' for 1 favorite", async () => {
    User.findById.mockResolvedValue(
      mockUser([{ isbn: "9780140449136", title: "A" }]),
    );
    const result = await listFavorites("user123");
    expect(result.message).toMatch(/1 book /);
  });

  test("handles user not found", async () => {
    User.findById.mockResolvedValue(null);
    const result = await listFavorites("nouser");
    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
  });
});

describe("getFavoriteCount", () => {
  afterEach(() => jest.restoreAllMocks());

  test("returns count", async () => {
    User.findById.mockResolvedValue(
      mockUser([{ isbn: "a" }, { isbn: "b" }]),
    );
    expect(await getFavoriteCount("user123")).toBe(2);
  });

  test("returns 0 for missing user", async () => {
    User.findById.mockResolvedValue(null);
    expect(await getFavoriteCount("nouser")).toBe(0);
  });
});

describe("clearFavorites", () => {
  afterEach(() => jest.restoreAllMocks());

  test("clears all favorites", async () => {
    const user = mockUser([{ isbn: "a" }, { isbn: "b" }]);
    User.findById.mockResolvedValue(user);

    const result = await clearFavorites("user123");
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Cleared 2 books/);
    expect(user.favorites).toEqual([]);
    expect(user.save).toHaveBeenCalled();
  });

  test("returns already-empty message", async () => {
    User.findById.mockResolvedValue(mockUser([]));
    const result = await clearFavorites("user123");
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/already empty/);
  });

  test("handles user not found", async () => {
    User.findById.mockResolvedValue(null);
    const result = await clearFavorites("nouser");
    expect(result.success).toBe(false);
  });
});
