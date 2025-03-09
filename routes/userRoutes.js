const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

router.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).send("Please fill in all fields");
  }

  const query =
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
  db.query(query, [username, email, password], (err, result) => {
    if (err) throw err;
    res.send("User registered successfully");
  });
});

router.post("/signin", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Please fill in all fields");
  }

  const query = "SELECT * FROM users WHERE username = ? AND password = ?";
  db.query(query, [username, password], (err, result) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).send("Internal server error");
    }
    if (result.length > 0) {
      const token = jwt.sign({ id: result[0].id }, "secret_key", {
        expiresIn: "1h",
      });
      res.json({ message: "User signed in successfully", token });
    } else {
      res.status(401).send("Invalid username or password");
    }
  });
});

module.exports = router;
