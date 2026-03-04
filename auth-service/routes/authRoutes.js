const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/appConfig");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn },
    );

    res.json({
      success: true,
      token,
      user: user.toPublic(),
    });
  } catch (error) {
    console.error("[auth-service] Login error:", error);
    res.status(500).json({ error: "An error occurred during login." });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
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

    res.status(201).json({
      success: true,
      token,
      user: user.toPublic(),
    });
  } catch (error) {
    console.error("[auth-service] Signup error:", error);
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
    return res.status(401).json({ valid: false, error: "No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    res.json({ valid: true, userId: decoded.userId, username: decoded.username });
  } catch (err) {
    res.status(401).json({ valid: false, error: "Invalid or expired token" });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true, user: user.toPublic() });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/dark-mode", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const { darkMode } = req.body;
    await User.findByIdAndUpdate(userId, { darkMode: Boolean(darkMode) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update preference" });
  }
});

module.exports = router;
