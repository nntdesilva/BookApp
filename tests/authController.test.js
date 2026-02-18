jest.mock("passport", () => ({
  authenticate: jest.fn(),
}));

jest.mock("../models/User", () => {
  const mockUser = jest.fn();
  mockUser.findOne = jest.fn();
  mockUser.register = jest.fn();
  return mockUser;
});

const passport = require("passport");
const User = require("../models/User");
const authController = require("../controllers/authController");

function mockReq(overrides = {}) {
  return {
    body: {},
    logIn: jest.fn((user, cb) => cb(null)),
    logout: jest.fn((cb) => cb(null)),
    ...overrides,
  };
}

function mockRes() {
  return {
    render: jest.fn(),
    redirect: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

// --- getLogin ---

describe("getLogin", () => {
  test("renders login page with no error", () => {
    const res = mockRes();
    authController.getLogin({}, res);
    expect(res.render).toHaveBeenCalledWith("auth/login", { error: null });
  });
});

// --- getSignup ---

describe("getSignup", () => {
  test("renders signup page with no error", () => {
    const res = mockRes();
    authController.getSignup({}, res);
    expect(res.render).toHaveBeenCalledWith("auth/signup", { error: null });
  });
});

// --- postLogin ---

describe("postLogin", () => {
  test("renders error when username missing", () => {
    const req = mockReq({ body: { username: "", password: "pass" } });
    const res = mockRes();

    authController.postLogin(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith(
      "auth/login",
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  test("renders error when password missing", () => {
    const req = mockReq({ body: { username: "user", password: "" } });
    const res = mockRes();

    authController.postLogin(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith(
      "auth/login",
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  test("calls passport.authenticate on valid credentials", () => {
    passport.authenticate.mockImplementation((strategy, cb) => {
      return (req, res, next) => {
        cb(null, { _id: "123", username: "user" }, null);
      };
    });

    const req = mockReq({ body: { username: "user", password: "pass123" } });
    const res = mockRes();

    authController.postLogin(req, res, jest.fn());

    expect(passport.authenticate).toHaveBeenCalledWith(
      "local",
      expect.any(Function),
    );
    expect(req.logIn).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith("/");
  });

  test("renders error when passport returns error", () => {
    passport.authenticate.mockImplementation((strategy, cb) => {
      return (req, res, next) => {
        cb(new Error("DB error"), null, null);
      };
    });

    const req = mockReq({ body: { username: "user", password: "pass" } });
    const res = mockRes();

    authController.postLogin(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith(
      "auth/login",
      expect.objectContaining({ error: expect.stringContaining("error") }),
    );
  });

  test("renders error when authentication fails (bad credentials)", () => {
    passport.authenticate.mockImplementation((strategy, cb) => {
      return (req, res, next) => {
        cb(null, null, { message: "Incorrect password" });
      };
    });

    const req = mockReq({ body: { username: "user", password: "wrong" } });
    const res = mockRes();

    authController.postLogin(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith(
      "auth/login",
      expect.objectContaining({ error: "Incorrect password" }),
    );
  });

  test("renders error when logIn fails", () => {
    passport.authenticate.mockImplementation((strategy, cb) => {
      return (req, res, next) => {
        cb(null, { _id: "1" }, null);
      };
    });

    const req = mockReq({
      body: { username: "user", password: "pass" },
      logIn: jest.fn((user, cb) => cb(new Error("Session error"))),
    });
    const res = mockRes();

    authController.postLogin(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith(
      "auth/login",
      expect.objectContaining({ error: expect.stringContaining("error") }),
    );
  });
});

// --- postSignup ---

describe("postSignup", () => {
  test("renders error when fields are missing", async () => {
    const req = mockReq({
      body: { username: "user", email: "", password: "pass", confirmPassword: "pass" },
    });
    const res = mockRes();

    await authController.postSignup(req, res);

    expect(res.render).toHaveBeenCalledWith(
      "auth/signup",
      expect.objectContaining({ error: "Please fill in all fields." }),
    );
  });

  test("renders error when passwords don't match", async () => {
    const req = mockReq({
      body: {
        username: "user",
        email: "a@b.com",
        password: "password1",
        confirmPassword: "password2",
      },
    });
    const res = mockRes();

    await authController.postSignup(req, res);

    expect(res.render).toHaveBeenCalledWith(
      "auth/signup",
      expect.objectContaining({ error: "Passwords do not match." }),
    );
  });

  test("renders error when password is too short", async () => {
    const req = mockReq({
      body: {
        username: "user",
        email: "a@b.com",
        password: "abc",
        confirmPassword: "abc",
      },
    });
    const res = mockRes();

    await authController.postSignup(req, res);

    expect(res.render).toHaveBeenCalledWith(
      "auth/signup",
      expect.objectContaining({ error: expect.stringContaining("6 characters") }),
    );
  });

  test("renders error when email already exists", async () => {
    User.findOne.mockResolvedValue({ email: "a@b.com" });

    const req = mockReq({
      body: {
        username: "user",
        email: "a@b.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });
    const res = mockRes();

    await authController.postSignup(req, res);

    expect(res.render).toHaveBeenCalledWith(
      "auth/signup",
      expect.objectContaining({ error: "Email is already registered." }),
    );
  });

  test("registers user and redirects on success", async () => {
    User.findOne.mockResolvedValue(null);
    User.register.mockResolvedValue({});
    User.mockImplementation((data) => data);

    const req = mockReq({
      body: {
        username: "newuser",
        email: "new@test.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });
    const res = mockRes();

    await authController.postSignup(req, res);

    expect(User.register).toHaveBeenCalled();
    expect(req.logIn).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith("/");
  });

  test("renders error on UserExistsError", async () => {
    User.findOne.mockResolvedValue(null);
    const err = new Error("Username taken");
    err.name = "UserExistsError";
    User.register.mockRejectedValue(err);
    User.mockImplementation((data) => data);

    const req = mockReq({
      body: {
        username: "taken",
        email: "t@t.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });
    const res = mockRes();

    await authController.postSignup(req, res);

    expect(res.render).toHaveBeenCalledWith(
      "auth/signup",
      expect.objectContaining({ error: "Username is already taken." }),
    );
  });

  test("renders error on ValidationError", async () => {
    User.findOne.mockResolvedValue(null);
    const err = new Error("Validation failed");
    err.name = "ValidationError";
    err.errors = { email: { message: "Invalid email format" } };
    User.register.mockRejectedValue(err);
    User.mockImplementation((data) => data);

    const req = mockReq({
      body: {
        username: "user",
        email: "bad",
        password: "password123",
        confirmPassword: "password123",
      },
    });
    const res = mockRes();

    await authController.postSignup(req, res);

    expect(res.render).toHaveBeenCalledWith(
      "auth/signup",
      expect.objectContaining({ error: "Invalid email format" }),
    );
  });

  test("renders generic error on unknown exception", async () => {
    User.findOne.mockResolvedValue(null);
    User.register.mockRejectedValue(new Error("Something broke"));
    User.mockImplementation((data) => data);

    const req = mockReq({
      body: {
        username: "user",
        email: "a@b.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });
    const res = mockRes();

    await authController.postSignup(req, res);

    expect(res.render).toHaveBeenCalledWith(
      "auth/signup",
      expect.objectContaining({
        error: "An error occurred during signup. Please try again.",
      }),
    );
  });
});

// --- logout ---

describe("logout", () => {
  test("logs out and redirects to /login", () => {
    const req = mockReq();
    const res = mockRes();

    authController.logout(req, res, jest.fn());

    expect(req.logout).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith("/login");
  });

  test("calls next on logout error", () => {
    const req = mockReq({
      logout: jest.fn((cb) => cb(new Error("Logout error"))),
    });
    const res = mockRes();
    const next = jest.fn();

    authController.logout(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
