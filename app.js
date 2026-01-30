const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
require("dotenv").config();

const app = express();

const bookRoutes = require("./routes/books");

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use("/", bookRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { error: err.message });
});

app.listen(3000, () => {
  console.log(`Server is running on port 3000`);
});
