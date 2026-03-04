jest.mock("jsonwebtoken");
jest.mock("../config/appConfig", () => ({
  jwt: {
    secret: "test-secret",
    cookieName: "token",
    cookieOptions: {},
  },
}));

const jwt = require("jsonwebtoken");
const { requireAuth, redirectIfAuth, optionalAuth } = require("../middleware/auth");

function mockReq({ token = null } = {}) {
  return {
    cookies: token ? { token } : {},
  };
}

function mockRes() {
  return {
    locals: {},
    redirect: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

describe("requireAuth", () => {
  test("calls next and sets req.user when token is valid", () => {
    jwt.verify.mockReturnValue({ userId: "user123", username: "testuser" });

    const req = mockReq({ token: "valid-token" });
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ _id: "user123", username: "testuser" });
    expect(res.locals.currentUser).toEqual(req.user);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  test("redirects to /login when no token", () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("/login");
    expect(next).not.toHaveBeenCalled();
  });

  test("redirects to /login when token is invalid", () => {
    jwt.verify.mockImplementation(() => { throw new Error("invalid"); });

    const req = mockReq({ token: "bad-token" });
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("/login");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("redirectIfAuth", () => {
  test("redirects to / when token is valid", () => {
    jwt.verify.mockReturnValue({ userId: "user123", username: "testuser" });

    const req = mockReq({ token: "valid-token" });
    const res = mockRes();
    const next = jest.fn();

    redirectIfAuth(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("/");
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next when no token", () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    redirectIfAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  test("calls next when token is invalid", () => {
    jwt.verify.mockImplementation(() => { throw new Error("expired"); });

    const req = mockReq({ token: "expired-token" });
    const res = mockRes();
    const next = jest.fn();

    redirectIfAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("optionalAuth", () => {
  test("sets req.user when token is valid", () => {
    jwt.verify.mockReturnValue({ userId: "user123", username: "testuser" });

    const req = mockReq({ token: "valid-token" });
    const next = jest.fn();

    optionalAuth(req, {}, next);

    expect(req.user).toEqual({ _id: "user123", username: "testuser" });
    expect(next).toHaveBeenCalled();
  });

  test("calls next without setting user when no token", () => {
    const req = mockReq();
    const next = jest.fn();

    optionalAuth(req, {}, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
