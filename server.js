// example.js
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
require("dotenv").config(); // Add dotenv package

const app = express();
const port = process.env.PORT || 3000; // Use environment variable for port

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to parse JSON data
app.use(bodyParser.json());

// Middleware to serve static files
app.use(express.static(__dirname));

// Serve the HTML form
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

// Handle form submission
app.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  insertUserData(username, email, password, res);
});

// Handle sign-in
app.post("/signin", (req, res) => {
  const { username, password } = req.body;
  authenticateUser(username, password, res);
});

// Handle adding budget
app.post("/addBudget", (req, res) => {
  const { userId, frequency, category, amount } = req.body;
  console.log("Received budget data:", { userId, frequency, category, amount }); // Log received data
  insertBudgetData(userId, frequency, category, amount, res);
});

// Function to authenticate user
function authenticateUser(username, password, res) {
  const connection = mysql.createConnection({
    host: process.env.DB_HOST, // Use environment variables for database connection
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  connection.connect((err) => {
    if (err) {
      console.log("Error connecting to MYSQL:", err);
      res.send("Database connection error");
    } else {
      console.log("Connected to MYSQL...");
      const query = "SELECT * FROM users WHERE username = ?";
      console.log(`Executing query: ${query} with username: ${username}`);
      connection.query(query, [username], (err, results) => {
        if (err) {
          console.log("Error querying data:", err);
          res.send("Error querying data");
        } else if (results.length > 0) {
          const user = results[0];
          console.log(`Comparing passwords for user: ${user.username}`);
          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
              console.log("Error comparing passwords:", err);
              res.send("Error comparing passwords");
            } else if (isMatch) {
              console.log("User authenticated successfully...");
              res.send({ message: "Sign-in successful", userId: user.id });
            } else {
              console.log("Invalid credentials...");
              res.send("Invalid username or password");
            }
          });
        } else {
          console.log("Invalid credentials...");
          res.send("Invalid username or password");
        }
        connection.end();
      });
    }
  });
}

// Function to insert user data into the database
function insertUserData(username, email, password, res) {
  const connection = mysql.createConnection({
    host: process.env.DB_HOST, // Use environment variables for database connection
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  connection.connect((err) => {
    if (err) {
      console.log("Error connecting to MYSQL:", err);
      res.send("Database connection error");
    } else {
      console.log("Connected to MYSQL...");
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
          console.log("Error hashing password:", err);
          res.send("Error hashing password");
        } else {
          const query =
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
          connection.query(query, [username, email, hash], (err, result) => {
            if (err) {
              console.log("Error inserting data:", err);
              res.send("Error inserting data");
            } else {
              console.log("Data inserted successfully...");
              res.send("User registered successfully");
            }
            connection.end();
          });
        }
      });
    }
  });
}

// Function to insert budget data into the database
function insertBudgetData(userId, frequency, category, amount, res) {
  const connection = mysql.createConnection({
    host: process.env.DB_HOST, // Use environment variables for database connection
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  connection.connect((err) => {
    if (err) {
      console.log("Error connecting to MYSQL:", err);
      res.send("Database connection error");
    } else {
      console.log("Connected to MYSQL...");
      const query =
        "INSERT INTO budgets (user_id, frequency, category, amount) VALUES (?, ?, ?, ?)";
      console.log("Executing query:", query); // Log the query
      connection.query(
        query,
        [userId, frequency, category, amount],
        (err, result) => {
          if (err) {
            console.log("Error inserting data:", err);
            res.send("Error inserting data");
          } else {
            console.log("Budget data inserted successfully...");
            res.send("Budget added successfully");
          }
          connection.end();
        }
      );
    }
  });
}

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.log("Error connecting to MYSQL:", err);
  } else {
    console.log("Connected to MYSQL...");

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
      );
    `;

    const createExpensesTable = `
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        date DATE,
        description VARCHAR(255),
        category VARCHAR(255),
        amount DECIMAL(10, 2),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

    const createBudgetsTable = `
      CREATE TABLE IF NOT EXISTS budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        frequency VARCHAR(255),
        category VARCHAR(255),
        amount DECIMAL(10, 2),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

    connection.query(createUsersTable, (err, result) => {
      if (err) {
        console.log("Error creating users table:", err);
      } else {
        console.log("Users table created or already exists.");
      }
    });

    connection.query(createExpensesTable, (err, result) => {
      if (err) {
        console.log("Error creating expenses table:", err);
      } else {
        console.log("Expenses table created or already exists.");
      }
    });

    connection.query(createBudgetsTable, (err, result) => {
      if (err) {
        console.log("Error creating budgets table:", err);
      } else {
        console.log("Budgets table created or already exists.");
      }
    });
    connection.query(
      'INSERT INTO budgets (user_id, frequency, category, amount) VALUES (1, "Monthly", "Food", 500)',
      (err, result) => {
        if (err) {
          console.log("Error inserting data:", err);
        } else {
          console.log("Data inserted successfully...");
        }
      }
    );
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
