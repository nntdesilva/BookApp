module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
    cookieName: "token",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: "lax",
    },
  },
  services: {
    authUrl: (process.env.AUTH_SERVICE_URL || "http://localhost:3001").trim(),
    chatUrl: (process.env.CHAT_SERVICE_URL || "http://localhost:3005").trim(),
    favoritesUrl: (process.env.FAVORITES_SERVICE_URL || "http://localhost:3002").trim(),
  },
};
