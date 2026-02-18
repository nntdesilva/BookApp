const {
  validateMessage,
  sanitizeInput,
  validateEnvironment,
  validateIsbn13,
  validateFavoriteBook,
} = require("../utils/validators");

describe("validateMessage", () => {
  test("accepts a valid non-empty message", () => {
    expect(validateMessage("Hello")).toEqual({ valid: true });
  });

  test("accepts a message at the 5000-char boundary", () => {
    const msg = "a".repeat(5000);
    expect(validateMessage(msg)).toEqual({ valid: true });
  });

  test("rejects null / undefined", () => {
    expect(validateMessage(null)).toEqual({
      valid: false,
      error: "Message is required",
    });
    expect(validateMessage(undefined)).toEqual({
      valid: false,
      error: "Message is required",
    });
  });

  test("rejects empty string", () => {
    expect(validateMessage("")).toEqual({
      valid: false,
      error: "Message is required",
    });
  });

  test("rejects whitespace-only string", () => {
    expect(validateMessage("   ")).toEqual({
      valid: false,
      error: "Message cannot be empty",
    });
  });

  test("rejects non-string types", () => {
    expect(validateMessage(42)).toEqual({
      valid: false,
      error: "Message must be a string",
    });
    expect(validateMessage({})).toEqual({
      valid: false,
      error: "Message must be a string",
    });
    expect(validateMessage([])).toEqual({
      valid: false,
      error: "Message must be a string",
    });
  });

  test("rejects message exceeding 5000 characters", () => {
    const long = "x".repeat(5001);
    expect(validateMessage(long)).toEqual({
      valid: false,
      error: "Message is too long (max 5000 characters)",
    });
  });
});

describe("sanitizeInput", () => {
  test("escapes HTML angle brackets", () => {
    expect(sanitizeInput("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;",
    );
  });

  test("escapes quotes and slashes", () => {
    expect(sanitizeInput('"hello\' / world"')).toBe(
      "&quot;hello&#x27; &#x2F; world&quot;",
    );
  });

  test("returns empty string for non-string input", () => {
    expect(sanitizeInput(123)).toBe("");
    expect(sanitizeInput(null)).toBe("");
    expect(sanitizeInput(undefined)).toBe("");
  });

  test("leaves safe text unchanged", () => {
    expect(sanitizeInput("Hello world")).toBe("Hello world");
  });
});

describe("validateEnvironment", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("returns valid when all required vars are present", () => {
    process.env.FOO = "bar";
    process.env.BAZ = "qux";
    expect(validateEnvironment(["FOO", "BAZ"])).toEqual({
      valid: true,
      missing: [],
    });
  });

  test("reports missing variables", () => {
    delete process.env.MISSING_VAR;
    expect(validateEnvironment(["MISSING_VAR"])).toEqual({
      valid: false,
      missing: ["MISSING_VAR"],
    });
  });

  test("handles empty required list", () => {
    expect(validateEnvironment([])).toEqual({ valid: true, missing: [] });
  });
});

describe("validateIsbn13", () => {
  test("validates correct ISBN-13 (9780140449136 – The Brothers Karamazov)", () => {
    const result = validateIsbn13("9780140449136");
    expect(result.valid).toBe(true);
    expect(result.normalizedIsbn).toBe("9780140449136");
  });

  test("accepts ISBN-13 with hyphens", () => {
    const result = validateIsbn13("978-0-14-044913-6");
    expect(result.valid).toBe(true);
    expect(result.normalizedIsbn).toBe("9780140449136");
  });

  test("accepts ISBN-13 with spaces", () => {
    const result = validateIsbn13("978 0 14 044913 6");
    expect(result.valid).toBe(true);
  });

  test("rejects invalid checksum", () => {
    const result = validateIsbn13("9780140449135");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/checksum/i);
  });

  test("rejects too-short string", () => {
    const result = validateIsbn13("978014044");
    expect(result.valid).toBe(false);
  });

  test("rejects non-digit characters", () => {
    const result = validateIsbn13("978014044913X");
    expect(result.valid).toBe(false);
  });

  test("rejects null / undefined / non-string", () => {
    expect(validateIsbn13(null).valid).toBe(false);
    expect(validateIsbn13(undefined).valid).toBe(false);
    expect(validateIsbn13(12345).valid).toBe(false);
  });
});

describe("validateFavoriteBook", () => {
  test("accepts valid book data", () => {
    const result = validateFavoriteBook({
      isbn13: "9780140449136",
      title: "The Brothers Karamazov",
    });
    expect(result.valid).toBe(true);
  });

  test("rejects null / non-object", () => {
    expect(validateFavoriteBook(null).valid).toBe(false);
    expect(validateFavoriteBook("string").valid).toBe(false);
  });

  test("rejects missing title", () => {
    const result = validateFavoriteBook({ isbn13: "9780140449136" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/title/i);
  });

  test("rejects empty title", () => {
    const result = validateFavoriteBook({
      isbn13: "9780140449136",
      title: "   ",
    });
    expect(result.valid).toBe(false);
  });

  test("rejects title exceeding 500 characters", () => {
    const result = validateFavoriteBook({
      isbn13: "9780140449136",
      title: "A".repeat(501),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too long/i);
  });

  test("rejects invalid ISBN in book data", () => {
    const result = validateFavoriteBook({
      isbn13: "9780140449135",
      title: "Bad Book",
    });
    expect(result.valid).toBe(false);
  });
});
