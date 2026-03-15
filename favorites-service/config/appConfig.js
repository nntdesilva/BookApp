module.exports = {
  server: {
    port: process.env.FAVORITES_SERVICE_PORT || 3002,
    env: process.env.NODE_ENV || "development",
  },
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bookapp_favorites",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
  },
};
