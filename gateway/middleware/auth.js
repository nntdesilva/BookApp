const jwt = require("jsonwebtoken");
const config = require("../config/appConfig");

function verifyToken(req) {
  const token = req.cookies && req.cookies[config.jwt.cookieName];
  if (!token) {
    console.log(
      `[gateway:auth] verifyToken: no '${config.jwt.cookieName}' cookie —` +
      ` cookies present: [${Object.keys(req.cookies || {}).join(", ") || "none"}]` +
      ` path=${req.path}`
    );
    return null;
  }

  console.log(
    `[gateway:auth] verifyToken: found cookie '${config.jwt.cookieName}'` +
    ` token_length=${token.length}` +
    ` secret_length=${config.jwt.secret.length}` +
    ` path=${req.path}`
  );

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    console.log(
      `[gateway:auth] verifyToken: ok — user=${decoded.username}` +
      ` userId=${decoded.userId}` +
      ` iat=${decoded.iat} exp=${decoded.exp}` +
      ` now=${Math.floor(Date.now() / 1000)}` +
      ` expires_in=${decoded.exp - Math.floor(Date.now() / 1000)}s`
    );
    return decoded;
  } catch (err) {
    console.warn(
      `[gateway:auth] verifyToken: jwt.verify FAILED — ${err.name}: ${err.message}` +
      ` secret_length=${config.jwt.secret.length}` +
      ` token_length=${token.length}` +
      ` path=${req.path}`
    );
    return null;
  }
}

function requireAuth(req, res, next) {
  console.log(`[gateway:auth] requireAuth: checking ${req.method} ${req.path}`);
  const decoded = verifyToken(req);
  if (!decoded) {
    console.warn(`[gateway:auth] requireAuth: no valid token — redirecting to /login (${req.method} ${req.path})`);
    return res.redirect("/login");
  }
  req.user = { _id: decoded.userId, username: decoded.username };
  res.locals.currentUser = req.user;
  console.log(`[gateway:auth] requireAuth: authorized user=${decoded.username}`);
  next();
}

function redirectIfAuth(req, res, next) {
  console.log(`[gateway:auth] redirectIfAuth: checking ${req.method} ${req.path}`);
  const decoded = verifyToken(req);
  if (decoded) {
    console.log(`[gateway:auth] redirectIfAuth: already authenticated (user=${decoded.username}) — redirecting to /`);
    return res.redirect("/");
  }
  console.log(`[gateway:auth] redirectIfAuth: not authenticated — proceeding`);
  next();
}

function optionalAuth(req, _res, next) {
  const decoded = verifyToken(req);
  if (decoded) {
    req.user = { _id: decoded.userId, username: decoded.username };
    console.log(`[gateway:auth] optionalAuth: resolved user=${decoded.username} for ${req.method} ${req.path}`);
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfAuth,
  optionalAuth,
  verifyToken,
};
