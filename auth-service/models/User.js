const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
  },
  passwordHash: {
    type: String,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.statics.register = async function (username, email, password) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return this.create({ username, email, passwordHash: hash });
};

userSchema.methods.verifyPassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    darkMode: this.darkMode,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model("User", userSchema);
module.exports = User;
