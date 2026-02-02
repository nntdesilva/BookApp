const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
require("dotenv").config();

const app = express();

// Import configuration
const config = require("./config/appConfig");

// Import routes
const bookRoutes = require("./routes/bookRoutes");

// View engine setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(session(config.session));

// Routes
app.use("/", bookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { error: err.message });
});

app.listen(config.server.port, () => {
  console.log(`Server is running on port ${config.server.port}`);
  console.log(`Environment: ${config.server.env}`);
});
