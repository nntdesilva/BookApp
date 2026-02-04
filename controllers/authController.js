/**
 * Auth Controller - Handles authentication-related HTTP requests using Passport.js
 */

const passport = require("passport");
const User = require("../models/User");

/**
 * Render login page
 * @route GET /login
 */
module.exports.getLogin = (req, res) => {
  res.render("auth/login", {
    error: null,
  });
};

/**
 * Handle login form submission using Passport
 * @route POST /login
 */
module.exports.postLogin = (req, res, next) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.render("auth/login", {
      error: "Please provide both username and password.",
    });
  }

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Login error:", err);
      return res.render("auth/login", {
        error: "An error occurred during login. Please try again.",
      });
    }

    if (!user) {
      return res.render("auth/login", {
        error: info.message || "Invalid username or password.",
      });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error("Session error:", err);
        return res.render("auth/login", {
          error: "An error occurred during login. Please try again.",
        });
      }

      return res.redirect("/");
    });
  })(req, res, next);
};

/**
 * Render signup page
 * @route GET /signup
 */
module.exports.getSignup = (req, res) => {
  res.render("auth/signup", {
    error: null,
  });
};

/**
 * Handle signup form submission using passport-local-mongoose
 * @route POST /signup
 */
module.exports.postSignup = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
      return res.render("auth/signup", {
        error: "Please fill in all fields.",
      });
    }

    // Check password match
    if (password !== confirmPassword) {
      return res.render("auth/signup", {
        error: "Passwords do not match.",
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.render("auth/signup", {
        error: "Password must be at least 6 characters.",
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({
      email: email.trim().toLowerCase(),
    });
    if (existingEmail) {
      return res.render("auth/signup", {
        error: "Email is already registered.",
      });
    }

    // Create new user with email (username and password handled by plugin)
    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
    });

    // Use passport-local-mongoose's register method to hash password
    await User.register(user, password);

    // Auto-login after signup using Passport
    req.logIn(user, (err) => {
      if (err) {
        console.error("Auto-login error:", err);
        return res.redirect("/login");
      }
      return res.redirect("/");
    });
  } catch (error) {
    console.error("Signup error:", error);

    // Handle passport-local-mongoose errors
    if (error.name === "UserExistsError") {
      return res.render("auth/signup", {
        error: "Username is already taken.",
      });
    }

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.render("auth/signup", {
        error: messages[0],
      });
    }

    res.render("auth/signup", {
      error: "An error occurred during signup. Please try again.",
    });
  }
};

/**
 * Handle logout using Passport
 * @route POST /logout
 */
module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return next(err);
    }
    res.redirect("/login");
  });
};
