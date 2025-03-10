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
              res.send("Sign-in successful");
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
