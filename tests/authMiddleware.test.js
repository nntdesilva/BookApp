const { requireAuth, redirectIfAuth } = require("../middleware/auth");

function mockReq(authenticated = false, user = null) {
  return {
    isAuthenticated: jest.fn().mockReturnValue(authenticated),
    user,
  };
}

function mockRes() {
  const res = {
    locals: {},
    redirect: jest.fn(),
  };
  return res;
}

describe("requireAuth", () => {
  test("calls next and sets currentUser when authenticated", () => {
    const user = { _id: "123", username: "tester" };
    const req = mockReq(true, user);
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.locals.currentUser).toBe(user);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  test("redirects to /login when not authenticated", () => {
    const req = mockReq(false);
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("/login");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("redirectIfAuth", () => {
  test("redirects to / when authenticated", () => {
    const req = mockReq(true);
    const res = mockRes();
    const next = jest.fn();

    redirectIfAuth(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("/");
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next when not authenticated", () => {
    const req = mockReq(false);
    const res = mockRes();
    const next = jest.fn();

    redirectIfAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
