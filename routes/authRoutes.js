/**
 * Auth Routes - Defines all routes related to authentication
 */

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { redirectIfAuth } = require("../middleware/auth");

// Login routes
router.get("/login", redirectIfAuth, authController.getLogin);
router.post("/login", redirectIfAuth, authController.postLogin);

// Signup routes
router.get("/signup", redirectIfAuth, authController.getSignup);
router.post("/signup", redirectIfAuth, authController.postSignup);

// Logout route
router.post("/logout", authController.logout);

module.exports = router;
