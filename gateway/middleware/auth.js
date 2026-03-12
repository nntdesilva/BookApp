const jwt = require("jsonwebtoken");
const config = require("../config/appConfig");
const logger = require("../config/logger").child({ component: "auth" });

function verifyToken(req) {
  const token = req.cookies && req.cookies[config.jwt.cookieName];
  if (!token) {
    logger.info({
      event: "verify_token_no_cookie",
      cookieName: config.jwt.cookieName,
      cookiesPresent: Object.keys(req.cookies || {}),
      path: req.path,
    });
    return null;
  }

  logger.info({
    event: "verify_token_found",
    cookieName: config.jwt.cookieName,
    tokenLength: token.length,
    path: req.path,
  });

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    logger.info({
      event: "verify_token_ok",
      username: decoded.username,
      userId: decoded.userId,
      iat: decoded.iat,
      exp: decoded.exp,
      expiresInSeconds: decoded.exp - Math.floor(Date.now() / 1000),
    });
    return decoded;
  } catch (err) {
    logger.warn({
      event: "verify_token_failed",
      reason: err.name,
      message: err.message,
      tokenLength: token.length,
      path: req.path,
    });
    return null;
  }
}

function requireAuth(req, res, next) {
  logger.info({ event: "require_auth_check", method: req.method, path: req.path });
  const decoded = verifyToken(req);
  if (!decoded) {
    logger.warn({ event: "require_auth_denied", method: req.method, path: req.path });
    return res.redirect("/login");
  }
  req.user = { _id: decoded.userId, username: decoded.username };
  res.locals.currentUser = req.user;
  logger.info({ event: "require_auth_ok", username: decoded.username });
  next();
}

function redirectIfAuth(req, res, next) {
  logger.info({ event: "redirect_if_auth_check", method: req.method, path: req.path });
  const decoded = verifyToken(req);
  if (decoded) {
    logger.info({ event: "redirect_if_auth_redirect", username: decoded.username });
    return res.redirect("/");
  }
  logger.info({ event: "redirect_if_auth_proceed" });
  next();
}

function optionalAuth(req, _res, next) {
  const decoded = verifyToken(req);
  if (decoded) {
    req.user = { _id: decoded.userId, username: decoded.username };
    logger.info({ event: "optional_auth_resolved", username: decoded.username, method: req.method, path: req.path });
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfAuth,
  optionalAuth,
  verifyToken,
};
