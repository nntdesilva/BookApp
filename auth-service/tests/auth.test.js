jest.mock("../models/User");
jest.mock("jsonwebtoken");

const express = require("express");
const request = require("supertest");

const User = require("../models/User");
const jwt = require("jsonwebtoken");
const authRoutes = require("../routes/authRoutes");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

beforeEach(() => jest.clearAllMocks());

// --- POST /api/auth/login ---

describe("POST /api/auth/login", () => {
  test("returns 400 when username missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "pass" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test("returns 400 when password missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "user" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test("returns 401 when user not found", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "unknown", password: "pass" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid/i);
  });

  test("returns 401 when password is wrong", async () => {
    const mockUser = { verifyPassword: jest.fn().mockResolvedValue(false) };
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "user", password: "wrong" });
    expect(res.status).toBe(401);
  });

  test("returns token and user on successful login", async () => {
    const mockUser = {
      _id: "user123",
      username: "testuser",
      verifyPassword: jest.fn().mockResolvedValue(true),
      toPublic: jest.fn().mockReturnValue({ id: "user123", username: "testuser" }),
    };
    User.findOne.mockResolvedValue(mockUser);
    jwt.sign.mockReturnValue("mocked-token");

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "pass123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe("mocked-token");
    expect(res.body.user.username).toBe("testuser");
  });

  test("returns 500 on unexpected error", async () => {
    User.findOne.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "user", password: "pass" });
    expect(res.status).toBe(500);
  });
});

// --- POST /api/auth/signup ---

describe("POST /api/auth/signup", () => {
  test("returns 400 when fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "user", password: "pass123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test("returns 400 when passwords don't match", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "user", email: "a@b.com", password: "pass123", confirmPassword: "different" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/match/i);
  });

  test("returns 400 when password too short", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "user", email: "a@b.com", password: "abc", confirmPassword: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  test("returns 409 when email already registered", async () => {
    User.findOne.mockResolvedValue({ email: "a@b.com" });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "user", email: "a@b.com", password: "pass123", confirmPassword: "pass123" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/email/i);
  });

  test("returns 409 when username already taken", async () => {
    User.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ username: "taken" });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "taken", email: "new@b.com", password: "pass123", confirmPassword: "pass123" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/username/i);
  });

  test("registers user and returns token on success", async () => {
    User.findOne.mockResolvedValue(null);
    const mockUser = {
      _id: "newuser1",
      username: "newuser",
      toPublic: jest.fn().mockReturnValue({ id: "newuser1", username: "newuser" }),
    };
    User.register.mockResolvedValue(mockUser);
    jwt.sign.mockReturnValue("signup-token");

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "newuser", email: "new@test.com", password: "pass123", confirmPassword: "pass123" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe("signup-token");
  });

  test("returns 409 on duplicate key error", async () => {
    User.findOne.mockResolvedValue(null);
    const err = new Error("Duplicate");
    err.code = 11000;
    User.register.mockRejectedValue(err);

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "dup", email: "dup@b.com", password: "pass123", confirmPassword: "pass123" });
    expect(res.status).toBe(409);
  });

  test("returns 400 on ValidationError", async () => {
    User.findOne.mockResolvedValue(null);
    const err = new Error("Validation failed");
    err.name = "ValidationError";
    err.errors = { email: { message: "Invalid email format" } };
    User.register.mockRejectedValue(err);

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "user", email: "bad", password: "pass123", confirmPassword: "pass123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid email format");
  });
});

// --- GET /api/auth/verify ---

describe("GET /api/auth/verify", () => {
  test("returns 401 when no token provided", async () => {
    const res = await request(app).get("/api/auth/verify");
    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  test("returns valid: true for good token", async () => {
    jwt.verify.mockReturnValue({ userId: "user123", username: "testuser" });

    const res = await request(app)
      .get("/api/auth/verify")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.userId).toBe("user123");
  });

  test("returns 401 for invalid token", async () => {
    jwt.verify.mockImplementation(() => { throw new Error("invalid token"); });

    const res = await request(app)
      .get("/api/auth/verify")
      .set("Authorization", "Bearer bad-token");

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });
});
