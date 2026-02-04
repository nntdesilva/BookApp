/**
 * User Model
 * Defines the user schema with authentication and favorites
 */

const mongoose = require("mongoose");
const passportLocalMongoose =
  require("passport-local-mongoose").default ||
  require("passport-local-mongoose");

/**
 * Favorite subdocument schema
 */
const favoriteSchema = new mongoose.Schema(
  {
    isbn: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * User schema
 */
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
  },
  favorites: [favoriteSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Add passport-local-mongoose plugin
 * This adds username, hash, and salt fields automatically
 * Also adds methods: authenticate, setPassword, changePassword, etc.
 */
userSchema.plugin(passportLocalMongoose, {
  usernameField: "username",
  usernameUnique: true,
  errorMessages: {
    UserExistsError: "Username is already taken.",
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
