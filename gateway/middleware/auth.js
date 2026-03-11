const jwt = require("jsonwebtoken");
const config = require("../config/appConfig");

function verifyToken(req) {
  const token = req.cookies && req.cookies[config.jwt.cookieName];
  if (!token) {
    console.log(`[gateway:auth] verifyToken: no '${config.jwt.cookieName}' cookie found. cookies present: [${Object.keys(req.cookies || {}).join(", ") || "none"}]`);
    return null;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    console.log(`[gateway:auth] verifyToken: ok (user=${decoded.username})`);
    return decoded;
  } catch (err) {
    console.log(`[gateway:auth] verifyToken: jwt.verify failed — ${err.name}: ${err.message}. secret_length=${config.jwt.secret.length}`);
    return null;
  }
}

function requireAuth(req, res, next) {
  const decoded = verifyToken(req);
  if (!decoded) {
    console.log(`[gateway:auth] requireAuth: no valid token for ${req.method} ${req.path} — redirecting to /login`);
    return res.redirect("/login");
  }
  req.user = { _id: decoded.userId, username: decoded.username };
  res.locals.currentUser = req.user;
  next();
}

function redirectIfAuth(req, res, next) {
  const decoded = verifyToken(req);
  if (decoded) {
    console.log(`[gateway:auth] redirectIfAuth: already authenticated (user=${decoded.username}) — redirecting to /`);
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
