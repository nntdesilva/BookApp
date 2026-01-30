const express = require("express");
const router = express.Router();
const bookController = require("../controllers/bookController");

router.get("/", bookController.index);
router.post("/search", bookController.search);
router.post("/chat", bookController.chat);

module.exports = router;
