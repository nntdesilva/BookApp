/**
 * Authentication Middleware
 * Handles route protection using Passport.js
 */

/**
 * Require authentication middleware
 * Redirects to login page if user is not authenticated
 */
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  // Make user available to views
  res.locals.currentUser = req.user;
  next();
}

/**
 * Redirect if authenticated middleware
 * Redirects to home page if user is already logged in
 * Used for login/signup pages
 */
function redirectIfAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfAuth,
};
