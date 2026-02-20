const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const passport = require("./config/passport");
require("dotenv").config();

// Import MongoStore - connect-mongo v6.x uses default export
const MongoStore = require("connect-mongo").default || require("connect-mongo");

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Import configuration
const config = require("./config/appConfig");
const { connectDB } = require("./config/database");

// Import routes
const bookRoutes = require("./routes/bookRoutes");
const authRoutes = require("./routes/authRoutes");

// Import middleware
const { requireAuth } = require("./middleware/auth");

// Connect to MongoDB
connectDB(config.mongodb.uri);

// View engine setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Session configuration with MongoDB store
app.use(
  session({
    ...config.session,
    store: MongoStore.create({
      mongoUrl: config.mongodb.uri,
      touchAfter: 24 * 60 * 60, // lazy session update (24 hours)
    }),
  })
);

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/", authRoutes);
app.use("/", requireAuth, bookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { error: err.message });
});

app.listen(config.server.port, () => {
  console.log(`Server is running on port ${config.server.port}`);
  console.log(`Environment: ${config.server.env}`);
});
