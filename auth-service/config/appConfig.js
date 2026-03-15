module.exports = {
  server: {
    port: process.env.AUTH_SERVICE_PORT || 3001,
    env: process.env.NODE_ENV || "development",
  },
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bookapp_auth",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },
};
