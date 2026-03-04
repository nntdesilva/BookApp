const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
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
});

favoriteSchema.index({ userId: 1, isbn: 1 }, { unique: true });

const Favorite = mongoose.model("Favorite", favoriteSchema);
module.exports = Favorite;
