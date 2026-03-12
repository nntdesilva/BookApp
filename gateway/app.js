const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const ejsMate = require("ejs-mate");
require("dotenv").config();

const config = require("./config/appConfig");
const logger = require("./config/logger");
const { requireAuth, redirectIfAuth, optionalAuth } = require("./middleware/auth");

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// ── Global request logger ────────────────────────────────────────────────────
app.use((req, _res, next) => {
  const cookies = Object.keys(req.cookies || {});
  logger.info({
    event: "request",
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    host: req.headers["host"] || "-",
    contentType: req.headers["content-type"] || "-",
    xForwardedFor: req.headers["x-forwarded-for"] || "-",
    xForwardedProto: req.headers["x-forwarded-proto"] || "-",
    cookies: cookies.length ? cookies : [],
  });
  next();
});

app.use(optionalAuth);
app.use((_req, res, next) => {
  if (!res.locals.currentUser) {
    res.locals.currentUser = null;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gateway" });
});

app.get("/login", redirectIfAuth, (_req, res) => {
  res.render("auth/login", { error: null });
});

app.post("/login", redirectIfAuth, async (req, res) => {
  try {
    const { username, password } = req.body;

    logger.info({
      event: "login_attempt",
      username: username || "(missing)",
      passwordPresent: !!password,
      bodyKeys: Object.keys(req.body || {}),
      contentType: req.headers["content-type"] || "-",
    });

    if (!username || !password) {
      logger.warn({ event: "login_body_missing", username: username || "(missing)" });
    }

    const targetUrl = `${config.services.authUrl}/api/auth/login`;
    logger.info({ event: "login_upstream_req", url: targetUrl, username });

    let authRes;
    try {
      authRes = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch (fetchErr) {
      logger.error({
        event: "login_upstream_fetch_failed",
        url: targetUrl,
        err: fetchErr,
      });
      return res.render("auth/login", {
        error: "An error occurred during login. Please try again.",
      });
    }

    logger.info({
      event: "login_upstream_res",
      httpStatus: authRes.status,
      contentType: authRes.headers.get("content-type") || "-",
    });

    let data;
    try {
      data = await authRes.json();
    } catch (parseErr) {
      logger.error({ event: "login_parse_failed", httpStatus: authRes.status, err: parseErr });
      return res.render("auth/login", {
        error: "An error occurred during login. Please try again.",
      });
    }

    if (!authRes.ok || !data.success) {
      logger.warn({
        event: "login_failed",
        username,
        httpStatus: authRes.status,
        reason: data.error || "(no error message)",
      });
      return res.render("auth/login", {
        error: data.error || "Invalid username or password.",
      });
    }

    const cookieOpts = config.jwt.cookieOptions;
    logger.info({
      event: "login_success",
      username,
      cookieName: config.jwt.cookieName,
      tokenLength: data.token ? data.token.length : 0,
      cookieSecure: cookieOpts.secure,
      cookieSameSite: cookieOpts.sameSite,
      cookieHttpOnly: cookieOpts.httpOnly,
      cookieMaxAge: cookieOpts.maxAge,
    });
    res.cookie(config.jwt.cookieName, data.token, cookieOpts);
    res.redirect("/");
  } catch (error) {
    logger.error({ event: "login_unexpected_error", err: error });
    res.render("auth/login", {
      error: "An error occurred during login. Please try again.",
    });
  }
});

app.get("/signup", redirectIfAuth, (_req, res) => {
  res.render("auth/signup", { error: null });
});

app.post("/signup", redirectIfAuth, async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    logger.info({
      event: "signup_attempt",
      username: username || "(missing)",
      email: email || "(missing)",
      passwordPresent: !!password,
      confirmPasswordPresent: !!confirmPassword,
      bodyKeys: Object.keys(req.body || {}),
    });

    const targetUrl = `${config.services.authUrl}/api/auth/signup`;
    logger.info({ event: "signup_upstream_req", url: targetUrl, username, email });

    let authRes;
    try {
      authRes = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, confirmPassword }),
      });
    } catch (fetchErr) {
      logger.error({
        event: "signup_upstream_fetch_failed",
        url: targetUrl,
        err: fetchErr,
      });
      return res.render("auth/signup", {
        error: "An error occurred during signup. Please try again.",
      });
    }

    logger.info({
      event: "signup_upstream_res",
      httpStatus: authRes.status,
      contentType: authRes.headers.get("content-type") || "-",
    });

    let data;
    try {
      data = await authRes.json();
    } catch (parseErr) {
      logger.error({ event: "signup_parse_failed", httpStatus: authRes.status, err: parseErr });
      return res.render("auth/signup", {
        error: "An error occurred during signup. Please try again.",
      });
    }

    if (!authRes.ok || !data.success) {
      logger.warn({
        event: "signup_failed",
        username,
        httpStatus: authRes.status,
        reason: data.error || "(no error message)",
      });
      return res.render("auth/signup", {
        error: data.error || "An error occurred during signup.",
      });
    }

    const cookieOpts = config.jwt.cookieOptions;
    logger.info({
      event: "signup_success",
      username,
      cookieName: config.jwt.cookieName,
      tokenLength: data.token ? data.token.length : 0,
      cookieSecure: cookieOpts.secure,
      cookieSameSite: cookieOpts.sameSite,
    });
    res.cookie(config.jwt.cookieName, data.token, cookieOpts);
    res.redirect("/");
  } catch (error) {
    logger.error({ event: "signup_unexpected_error", err: error });
    res.render("auth/signup", {
      error: "An error occurred during signup. Please try again.",
    });
  }
});

app.post("/logout", (req, res) => {
  const cookies = Object.keys(req.cookies || {});
  logger.info({
    event: "logout",
    cookieName: config.jwt.cookieName,
    cookiesBefore: cookies,
  });
  res.clearCookie(config.jwt.cookieName);
  res.redirect("/login");
});

app.get("/", (req, _res, next) => {
  logger.info({ event: "home_access", cookiesPresent: Object.keys(req.cookies || {}) });
  next();
}, requireAuth, (_req, res) => {
  res.render("books/index", { error: null });
});

app.post("/chat", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUrl = `${config.services.chatUrl}/api/chat`;
    logger.info({ event: "chat_proxy_req", url: targetUrl, username: req.user.username, userId });

    const chatRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-username": req.user.username,
      },
      body: JSON.stringify(req.body),
    });

    logger.info({ event: "chat_proxy_res", httpStatus: chatRes.status, userId });
    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    logger.error({ event: "chat_proxy_error", err: error });
    res.status(500).json({ error: "Failed to process chat message." });
  }
});

app.post("/clear", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUrl = `${config.services.chatUrl}/api/clear`;
    logger.info({ event: "clear_proxy_req", url: targetUrl, username: req.user.username, userId });

    const chatRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
    });

    logger.info({ event: "clear_proxy_res", httpStatus: chatRes.status, userId });
    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    logger.error({ event: "clear_proxy_error", err: error });
    res.status(500).json({ error: "Failed to clear conversation." });
  }
});

app.get("/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUrl = `${config.services.chatUrl}/api/stats`;
    logger.info({ event: "stats_proxy_req", url: targetUrl, username: req.user.username, userId });

    const chatRes = await fetch(targetUrl, {
      headers: { "x-user-id": userId },
    });

    logger.info({ event: "stats_proxy_res", httpStatus: chatRes.status, userId });
    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    logger.error({ event: "stats_proxy_error", err: error });
    res.status(500).json({ error: "Failed to get stats." });
  }
});

app.post("/api/dark-mode", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUrl = `${config.services.authUrl}/api/auth/dark-mode`;
    logger.info({ event: "dark_mode_proxy_req", url: targetUrl, username: req.user.username, userId });

    const authRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify(req.body),
    });

    logger.info({ event: "dark_mode_proxy_res", httpStatus: authRes.status, userId });
    const data = await authRes.json();
    res.status(authRes.status).json(data);
  } catch (error) {
    logger.error({ event: "dark_mode_proxy_error", err: error });
    res.status(500).json({ error: "Failed to update preference." });
  }
});

app.use((err, req, res, _next) => {
  logger.error({
    event: "unhandled_error",
    method: req.method,
    url: req.originalUrl,
    err,
  });
  res.status(500).render("error", { error: err.message });
});

if (require.main === module) {
  const cookieOpts = config.jwt.cookieOptions;
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    logger.info({
      event: "startup",
      port: { status: e("PORT"), value: config.server.port },
      nodeEnv: { status: e("NODE_ENV"), value: config.server.env },
      jwtSecret: { status: e("JWT_SECRET"), length: config.jwt.secret.length, hint: config.jwt.secret.slice(0, 4) + "..." },
      authServiceUrl: { status: e("AUTH_SERVICE_URL"), value: config.services.authUrl },
      chatServiceUrl: { status: e("CHAT_SERVICE_URL"), value: config.services.chatUrl },
      favoritesServiceUrl: { status: e("FAVORITES_SERVICE_URL"), value: config.services.favoritesUrl },
      trustProxy: process.env.NODE_ENV === "production",
      cookie: {
        name: config.jwt.cookieName,
        httpOnly: cookieOpts.httpOnly,
        secure: cookieOpts.secure,
        sameSite: cookieOpts.sameSite,
        maxAge: cookieOpts.maxAge,
      },
    });
    if (!process.env.JWT_SECRET)       logger.warn({ event: "startup_warning", variable: "JWT_SECRET", msg: "not set — tokens will mismatch with auth-service in production" });
    if (!process.env.AUTH_SERVICE_URL) logger.warn({ event: "startup_warning", variable: "AUTH_SERVICE_URL", msg: "not set — login/signup will fail in production" });
    if (!process.env.CHAT_SERVICE_URL) logger.warn({ event: "startup_warning", variable: "CHAT_SERVICE_URL", msg: "not set — chat will fail in production" });
  });
}

module.exports = app;
