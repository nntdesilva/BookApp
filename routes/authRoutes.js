/**
 * Auth Routes - Defines all routes related to authentication
 */

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { redirectIfAuth } = require("../middleware/auth");
const User = require("../models/User");

// Login routes
router.get("/login", redirectIfAuth, authController.getLogin);
router.post("/login", redirectIfAuth, authController.postLogin);

// Signup routes
router.get("/signup", redirectIfAuth, authController.getSignup);
router.post("/signup", redirectIfAuth, authController.postSignup);

// Logout route
router.post("/logout", authController.logout);

// Dark mode preference
router.post("/api/dark-mode", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const { darkMode } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      darkMode: Boolean(darkMode),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update preference" });
  }
});

module.exports = router;
