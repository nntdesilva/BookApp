const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "authRoutes" });

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    logger.info({ event: "login_attempt", username: username || "(missing)", passwordPresent: !!password });

    if (!username || !password) {
      logger.warn({ event: "login_rejected", reason: "missing_credentials" });
      return res.status(400).json({ error: "Username and password are required." });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      logger.warn({ event: "login_failed", reason: "user_not_found", username });
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      logger.warn({ event: "login_failed", reason: "wrong_password", username, userId: user._id });
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn },
    );

    logger.info({ event: "login_success", username, userId: user._id, tokenLength: token.length });
    res.json({ success: true, token, user: user.toPublic() });
  } catch (error) {
    logger.error({ event: "login_unexpected_error", username: req.body?.username, err: error });
    res.status(500).json({ error: "An error occurred during login." });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    logger.info({
      event: "signup_attempt",
      username: username || "(missing)",
      email: email || "(missing)",
      passwordPresent: !!password,
      confirmPasswordPresent: !!confirmPassword,
    });

    if (!username || !email || !password || !confirmPassword) {
      logger.warn({ event: "signup_rejected", reason: "missing_fields" });
      return res.status(400).json({ error: "All fields are required." });
    }

    if (password !== confirmPassword) {
      logger.warn({ event: "signup_rejected", reason: "password_mismatch", username });
      return res.status(400).json({ error: "Passwords do not match." });
    }

    if (password.length < 6) {
      logger.warn({ event: "signup_rejected", reason: "password_too_short", username });
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      logger.warn({ event: "signup_rejected", reason: "email_taken", email });
      return res.status(409).json({ error: "Email is already registered." });
    }

    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      logger.warn({ event: "signup_rejected", reason: "username_taken", username });
      return res.status(409).json({ error: "Username is already taken." });
    }

    const user = await User.register(
      username.trim(),
      email.trim().toLowerCase(),
      password,
    );

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn },
    );

    logger.info({ event: "signup_success", username, userId: user._id, tokenLength: token.length });
    res.status(201).json({ success: true, token, user: user.toPublic() });
  } catch (error) {
    logger.error({ event: "signup_unexpected_error", username: req.body?.username, err: error });
    if (error.code === 11000) {
      return res.status(409).json({ error: "Username or email already exists." });
    }
    if (error.name === "ValidationError") {
      const msg = Object.values(error.errors).map((e) => e.message)[0];
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: "An error occurred during signup." });
  }
});

router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn({ event: "verify_rejected", reason: "no_bearer_token" });
    return res.status(401).json({ valid: false, error: "No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    logger.info({ event: "verify_success", userId: decoded.userId, username: decoded.username });
    res.json({ valid: true, userId: decoded.userId, username: decoded.username });
  } catch (err) {
    logger.warn({ event: "verify_failed", reason: err.message });
    res.status(401).json({ valid: false, error: "Invalid or expired token" });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    logger.info({ event: "get_user", userId });
    const user = await User.findById(userId);
    if (!user) {
      logger.warn({ event: "get_user_not_found", userId });
      return res.status(404).json({ error: "User not found" });
    }
    logger.info({ event: "get_user_success", userId, username: user.username });
    res.json({ success: true, user: user.toPublic() });
  } catch (error) {
    logger.error({ event: "get_user_error", userId: req.params.userId, err: error });
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/dark-mode", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    logger.warn({ event: "dark_mode_rejected", reason: "missing_user_id" });
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const { darkMode } = req.body;
    logger.info({ event: "dark_mode_update", userId, darkMode });
    await User.findByIdAndUpdate(userId, { darkMode: Boolean(darkMode) });
    logger.info({ event: "dark_mode_updated", userId, darkMode: Boolean(darkMode) });
    res.json({ success: true });
  } catch (err) {
    logger.error({ event: "dark_mode_error", userId, err });
    res.status(500).json({ error: "Failed to update preference" });
  }
});

module.exports = router;
