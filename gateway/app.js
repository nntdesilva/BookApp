const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const ejsMate = require("ejs-mate");
require("dotenv").config();

const config = require("./config/appConfig");
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
  console.log(
    `[gateway:req] ${req.method} ${req.originalUrl}` +
    ` | ip=${req.ip}` +
    ` | host=${req.headers["host"] || "-"}` +
    ` | content-type=${req.headers["content-type"] || "-"}` +
    ` | x-forwarded-for=${req.headers["x-forwarded-for"] || "-"}` +
    ` | x-forwarded-proto=${req.headers["x-forwarded-proto"] || "-"}` +
    ` | cookies=[${cookies.join(", ") || "none"}]`
  );
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

    console.log(
      `[gateway] POST /login — body parsed: username=${username || "(missing)"} password_present=${!!password}` +
      ` body_keys=[${Object.keys(req.body || {}).join(", ") || "none"}]` +
      ` content-type=${req.headers["content-type"] || "-"}`
    );

    if (!username || !password) {
      console.warn("[gateway] POST /login — missing username or password in parsed body; body may not have been parsed correctly");
    }

    const targetUrl = `${config.services.authUrl}/api/auth/login`;
    console.log(`[gateway] POST /login -> ${targetUrl} (user: ${username})`);

    let authRes;
    try {
      authRes = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch (fetchErr) {
      console.error(
        `[gateway] Login fetch failed — url=${targetUrl}` +
        ` error=${fetchErr.message}` +
        ` code=${fetchErr.code || "-"}` +
        ` cause=${fetchErr.cause ? String(fetchErr.cause) : "-"}`
      );
      return res.render("auth/login", {
        error: "An error occurred during login. Please try again.",
      });
    }

    console.log(
      `[gateway] Login auth-service responded — http_status=${authRes.status}` +
      ` content-type=${authRes.headers.get("content-type") || "-"}`
    );

    let data;
    try {
      data = await authRes.json();
    } catch (parseErr) {
      console.error(`[gateway] Login response parse failed (status: ${authRes.status}):`, parseErr.message);
      return res.render("auth/login", {
        error: "An error occurred during login. Please try again.",
      });
    }

    console.log(`[gateway] Login response body: status=${authRes.status} success=${data.success} error=${data.error || "none"}`);

    if (!authRes.ok || !data.success) {
      console.warn(`[gateway] Login failed for user=${username} — auth-service said: ${data.error || "(no error message)"}`);
      return res.render("auth/login", {
        error: data.error || "Invalid username or password.",
      });
    }

    const cookieOpts = config.jwt.cookieOptions;
    console.log(
      `[gateway] Login success for user=${username} — setting cookie '${config.jwt.cookieName}'` +
      ` token_length=${data.token ? data.token.length : 0}` +
      ` secure=${cookieOpts.secure}` +
      ` sameSite=${cookieOpts.sameSite}` +
      ` httpOnly=${cookieOpts.httpOnly}` +
      ` maxAge=${cookieOpts.maxAge}`
    );
    res.cookie(config.jwt.cookieName, data.token, cookieOpts);
    console.log(`[gateway] Login: redirecting to /`);
    res.redirect("/");
  } catch (error) {
    console.error("[gateway] Login unexpected error:", error.message, error.stack);
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

    console.log(
      `[gateway] POST /signup — body parsed: username=${username || "(missing)"} email=${email || "(missing)"}` +
      ` password_present=${!!password} confirmPassword_present=${!!confirmPassword}` +
      ` body_keys=[${Object.keys(req.body || {}).join(", ") || "none"}]`
    );

    const targetUrl = `${config.services.authUrl}/api/auth/signup`;
    console.log(`[gateway] POST /signup -> ${targetUrl} (user: ${username}, email: ${email})`);

    let authRes;
    try {
      authRes = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, confirmPassword }),
      });
    } catch (fetchErr) {
      console.error(
        `[gateway] Signup fetch failed — url=${targetUrl}` +
        ` error=${fetchErr.message}` +
        ` code=${fetchErr.code || "-"}` +
        ` cause=${fetchErr.cause ? String(fetchErr.cause) : "-"}`
      );
      return res.render("auth/signup", {
        error: "An error occurred during signup. Please try again.",
      });
    }

    console.log(
      `[gateway] Signup auth-service responded — http_status=${authRes.status}` +
      ` content-type=${authRes.headers.get("content-type") || "-"}`
    );

    let data;
    try {
      data = await authRes.json();
    } catch (parseErr) {
      console.error(`[gateway] Signup response parse failed (status: ${authRes.status}):`, parseErr.message);
      return res.render("auth/signup", {
        error: "An error occurred during signup. Please try again.",
      });
    }

    console.log(`[gateway] Signup response body: status=${authRes.status} success=${data.success} error=${data.error || "none"}`);

    if (!authRes.ok || !data.success) {
      console.warn(`[gateway] Signup failed for user=${username} — auth-service said: ${data.error || "(no error message)"}`);
      return res.render("auth/signup", {
        error: data.error || "An error occurred during signup.",
      });
    }

    const cookieOpts = config.jwt.cookieOptions;
    console.log(
      `[gateway] Signup success for user=${username} — setting cookie '${config.jwt.cookieName}'` +
      ` token_length=${data.token ? data.token.length : 0}` +
      ` secure=${cookieOpts.secure}` +
      ` sameSite=${cookieOpts.sameSite}` +
      ` httpOnly=${cookieOpts.httpOnly}` +
      ` maxAge=${cookieOpts.maxAge}`
    );
    res.cookie(config.jwt.cookieName, data.token, cookieOpts);
    console.log(`[gateway] Signup: redirecting to /`);
    res.redirect("/");
  } catch (error) {
    console.error("[gateway] Signup unexpected error:", error.message, error.stack);
    res.render("auth/signup", {
      error: "An error occurred during signup. Please try again.",
    });
  }
});

app.post("/logout", (req, res) => {
  const cookies = Object.keys(req.cookies || {});
  console.log(`[gateway] POST /logout — clearing cookie '${config.jwt.cookieName}' cookies_before=[${cookies.join(", ") || "none"}]`);
  res.clearCookie(config.jwt.cookieName);
  res.redirect("/login");
});

app.get("/", (req, _res, next) => {
  console.log(`[gateway] GET /: cookies present: [${Object.keys(req.cookies || {}).join(", ") || "none"}]`);
  next();
}, requireAuth, (_req, res) => {
  res.render("books/index", { error: null });
});

app.post("/chat", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUrl = `${config.services.chatUrl}/api/chat`;
    console.log(`[gateway] POST /chat -> ${targetUrl} user=${req.user.username} (${userId})`);

    const chatRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-username": req.user.username,
      },
      body: JSON.stringify(req.body),
    });

    console.log(`[gateway] /chat response: http_status=${chatRes.status}`);
    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    console.error("[gateway] Chat proxy error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to process chat message." });
  }
});

app.post("/clear", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUrl = `${config.services.chatUrl}/api/clear`;
    console.log(`[gateway] POST /clear -> ${targetUrl} user=${req.user.username} (${userId})`);

    const chatRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
    });

    console.log(`[gateway] /clear response: http_status=${chatRes.status}`);
    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    console.error("[gateway] Clear proxy error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to clear conversation." });
  }
});

app.get("/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUrl = `${config.services.chatUrl}/api/stats`;
    console.log(`[gateway] GET /stats -> ${targetUrl} user=${req.user.username} (${userId})`);

    const chatRes = await fetch(targetUrl, {
      headers: { "x-user-id": userId },
    });

    console.log(`[gateway] /stats response: http_status=${chatRes.status}`);
    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    console.error("[gateway] Stats proxy error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to get stats." });
  }
});

app.post("/api/dark-mode", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUrl = `${config.services.authUrl}/api/auth/dark-mode`;
    console.log(`[gateway] POST /api/dark-mode -> ${targetUrl} user=${req.user.username} (${userId})`);

    const authRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify(req.body),
    });

    console.log(`[gateway] /api/dark-mode response: http_status=${authRes.status}`);
    const data = await authRes.json();
    res.status(authRes.status).json(data);
  } catch (error) {
    console.error("[gateway] Dark mode proxy error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to update preference." });
  }
});

app.use((err, req, res, _next) => {
  console.error(
    `[gateway] Unhandled error — ${req.method} ${req.originalUrl}:`,
    err.message,
    err.stack
  );
  res.status(500).render("error", { error: err.message });
});

if (require.main === module) {
  const cookieOpts = config.jwt.cookieOptions;
  app.listen(config.server.port, () => {
    const e = (name) => process.env[name] !== undefined ? "set" : "NOT SET (using default)";
    console.log("[gateway] ── startup config ──────────────────────────");
    console.log(`[gateway] PORT                : ${e("PORT")} → ${config.server.port}`);
    console.log(`[gateway] NODE_ENV            : ${e("NODE_ENV")} → ${config.server.env}`);
    console.log(`[gateway] JWT_SECRET          : ${e("JWT_SECRET")} (length=${config.jwt.secret.length} hint=${config.jwt.secret.slice(0, 4)}...)`);
    console.log(`[gateway] AUTH_SERVICE_URL    : ${e("AUTH_SERVICE_URL")} → ${config.services.authUrl}`);
    console.log(`[gateway] CHAT_SERVICE_URL    : ${e("CHAT_SERVICE_URL")} → ${config.services.chatUrl}`);
    console.log(`[gateway] FAVORITES_SERVICE_URL: ${e("FAVORITES_SERVICE_URL")} → ${config.services.favoritesUrl}`);
    console.log(`[gateway] trust proxy         : ${process.env.NODE_ENV === "production"}`);
    console.log(`[gateway] cookie.name         : ${config.jwt.cookieName}`);
    console.log(`[gateway] cookie.httpOnly     : ${cookieOpts.httpOnly}`);
    console.log(`[gateway] cookie.secure       : ${cookieOpts.secure}`);
    console.log(`[gateway] cookie.sameSite     : ${cookieOpts.sameSite}`);
    console.log(`[gateway] cookie.maxAge       : ${cookieOpts.maxAge}ms`);
    console.log("[gateway] ────────────────────────────────────────────");
    if (!process.env.JWT_SECRET)           console.warn("[gateway] WARNING: JWT_SECRET not set — using insecure dev default, tokens will mismatch with auth-service in production");
    if (!process.env.AUTH_SERVICE_URL)     console.warn("[gateway] WARNING: AUTH_SERVICE_URL not set — using localhost fallback, login/signup will fail in production");
    if (!process.env.CHAT_SERVICE_URL)     console.warn("[gateway] WARNING: CHAT_SERVICE_URL not set — using localhost fallback, chat will fail in production");
  });
}

module.exports = app;
