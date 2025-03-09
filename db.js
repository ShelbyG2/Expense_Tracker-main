const mysql = require("mysql");

const db = mysql.createConnection({
  host: "localhost",
  user: "shelby",
  password: "database",
  database: "Expense_Tracker",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected to database");
});

module.exports = db;
