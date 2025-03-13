const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));

// JWT Authentication Middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  insertUserData(username, email, password, res);
});

app.post("/signin", (req, res) => {
  const { username, password } = req.body;
  authenticateUser(username, password, res);
});

app.post("/addBudget", authenticateJWT, (req, res) => {
  const { frequency, category, amount } = req.body;
  const userId = req.user.userId;
  insertBudgetData(userId, frequency, category, amount, res);
});

// Database functions
function authenticateUser(username, password, res) {
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT * FROM users WHERE username = ?";
    connection.query(query, [username], (err, results) => {
      if (err) return handleError(res, "Error querying data", err);

      if (results.length === 0) return sendInvalidCredentials(res);

      const user = results[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return handleError(res, "Error comparing passwords", err);
        
        if (!isMatch) return sendInvalidCredentials(res);

        const token = jwt.sign(
          { userId: user.id },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        res.send({ 
          message: "Sign-in successful", 
          token: token,
          userId: user.id 
        });
      });
      connection.end();
    });
  });
}

function insertUserData(username, email, password, res) {
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return handleError(res, "Error hashing password", err);

      const query = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
      connection.query(query, [username, email, hash], (err, result) => {
        if (err) return handleError(res, "Error inserting data", err);
        
        res.send("User registered successfully");
        connection.end();
      });
    });
  });
}

function insertBudgetData(userId, frequency, category, amount, res) {
  if (!frequency || !category || !amount || isNaN(amount)) {
    return res.status(400).send("Invalid budget data");
  }

  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "INSERT INTO budgets (user_id, frequency, category, amount) VALUES (?, ?, ?, ?)";
    connection.query(query, [userId, frequency, category, amount], (err, result) => {
      if (err) return handleError(res, "Error inserting data", err);
      
      res.send("Budget added successfully");
      connection.end();
    });
  });
}

// Helpers
function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
}

function handleError(res, message, err) {
  console.error(message, err);
  res.status(500).send(message);
}

function sendInvalidCredentials(res) {
  console.log("Invalid credentials...");
  res.status(401).send("Invalid username or password");
}

// Database initialization
const connection = createConnection();
connection.connect((err) => {
  if (err) return console.error("Error connecting to MySQL:", err);

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      date DATE,
      description VARCHAR(255),
      category VARCHAR(255),
      amount DECIMAL(10, 2),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      frequency VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ];

  tables.forEach((table) => {
    connection.query(table, (err) => {
      if (err) console.error("Error creating table:", err);
    });
  });

  connection.end();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
