const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticate = require("../middleware/authenticate");

router.post("/add", authenticate, (req, res) => {
  const { userId, amount, description, date } = req.body;
  const query =
    "INSERT INTO expenses (user_id, amount, description, date) VALUES (?, ?, ?, ?)";
  db.query(query, [userId, amount, description, date], (err, result) => {
    if (err) throw err;
    res.send("Expense added successfully");
  });
});

router.get("/list", authenticate, (req, res) => {
  const userId = req.user.id;
  const query = "SELECT * FROM expenses WHERE user_id = ?";
  db.query(query, [userId], (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

router.put("/update/:id", authenticate, (req, res) => {
  const { amount, description, date } = req.body;
  const query =
    "UPDATE expenses SET amount = ?, description = ?, date = ? WHERE id = ?";
  db.query(query, [amount, description, date, req.params.id], (err, result) => {
    if (err) throw err;
    res.send("Expense updated successfully");
  });
});

router.delete("/delete/:id", authenticate, (req, res) => {
  const query = "DELETE FROM expenses WHERE id = ?";
  db.query(query, [req.params.id], (err, result) => {
    if (err) throw err;
    res.send("Expense deleted successfully");
  });
});

module.exports = router;
