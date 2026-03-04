const jwt = require("jsonwebtoken");
const config = require("../config/appConfig");

function verifyToken(req) {
  const token = req.cookies && req.cookies[config.jwt.cookieName];
  if (!token) return null;

  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const decoded = verifyToken(req);
  if (!decoded) {
    return res.redirect("/login");
  }
  req.user = { _id: decoded.userId, username: decoded.username };
  res.locals.currentUser = req.user;
  next();
}

function redirectIfAuth(req, res, next) {
  const decoded = verifyToken(req);
  if (decoded) {
    return res.redirect("/");
  }
  next();
}

function optionalAuth(req, _res, next) {
  const decoded = verifyToken(req);
  if (decoded) {
    req.user = { _id: decoded.userId, username: decoded.username };
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfAuth,
  optionalAuth,
  verifyToken,
};
