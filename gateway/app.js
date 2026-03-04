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

    const authRes = await fetch(`${config.services.authUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await authRes.json();

    if (!authRes.ok || !data.success) {
      return res.render("auth/login", {
        error: data.error || "Invalid username or password.",
      });
    }

    res.cookie(config.jwt.cookieName, data.token, config.jwt.cookieOptions);
    res.redirect("/");
  } catch (error) {
    console.error("[gateway] Login error:", error);
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

    const authRes = await fetch(`${config.services.authUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, confirmPassword }),
    });

    const data = await authRes.json();

    if (!authRes.ok || !data.success) {
      return res.render("auth/signup", {
        error: data.error || "An error occurred during signup.",
      });
    }

    res.cookie(config.jwt.cookieName, data.token, config.jwt.cookieOptions);
    res.redirect("/");
  } catch (error) {
    console.error("[gateway] Signup error:", error);
    res.render("auth/signup", {
      error: "An error occurred during signup. Please try again.",
    });
  }
});

app.post("/logout", (_req, res) => {
  res.clearCookie(config.jwt.cookieName);
  res.redirect("/login");
});

app.get("/", requireAuth, (_req, res) => {
  res.render("books/index", { error: null });
});

app.post("/chat", requireAuth, async (req, res) => {
  try {
    const chatRes = await fetch(`${config.services.chatUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": req.user._id,
        "x-username": req.user.username,
      },
      body: JSON.stringify(req.body),
    });

    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    console.error("[gateway] Chat proxy error:", error);
    res.status(500).json({ error: "Failed to process chat message." });
  }
});

app.post("/clear", requireAuth, async (req, res) => {
  try {
    const chatRes = await fetch(`${config.services.chatUrl}/api/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": req.user._id,
      },
    });

    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    console.error("[gateway] Clear proxy error:", error);
    res.status(500).json({ error: "Failed to clear conversation." });
  }
});

app.get("/stats", requireAuth, async (req, res) => {
  try {
    const chatRes = await fetch(`${config.services.chatUrl}/api/stats`, {
      headers: { "x-user-id": req.user._id },
    });

    const data = await chatRes.json();
    res.status(chatRes.status).json(data);
  } catch (error) {
    console.error("[gateway] Stats proxy error:", error);
    res.status(500).json({ error: "Failed to get stats." });
  }
});

app.post("/api/dark-mode", requireAuth, async (req, res) => {
  try {
    const authRes = await fetch(`${config.services.authUrl}/api/auth/dark-mode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": req.user._id,
      },
      body: JSON.stringify(req.body),
    });

    const data = await authRes.json();
    res.status(authRes.status).json(data);
  } catch (error) {
    console.error("[gateway] Dark mode proxy error:", error);
    res.status(500).json({ error: "Failed to update preference." });
  }
});

app.use((err, _req, res, _next) => {
  console.error("[gateway] Error:", err.stack);
  res.status(500).render("error", { error: err.message });
});

if (require.main === module) {
  app.listen(config.server.port, () => {
    console.log(`[gateway] Running on port ${config.server.port}`);
    console.log(`[gateway] Environment: ${config.server.env}`);
  });
}

module.exports = app;
