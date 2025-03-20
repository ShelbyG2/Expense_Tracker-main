require("dotenv").config({ path: ".env.local" });
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
    const token = authHeader.split(" ")[1];

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

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  authenticateUser(username, password, res);
});

// Budget routes
app.post("/addBudget", authenticateJWT, (req, res) => {
  const { frequency, category, amount } = req.body;
  const userId = req.user.userId;

  if (!frequency || !category || !amount || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid budget data" });
  }

  insertBudgetData(userId, frequency, category, amount, res);
});

app.get("/getBudgets", authenticateJWT, (req, res) => {
  const userId = req.user.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT * FROM budgets WHERE user_id = ? ORDER BY category";
    connection.query(query, [userId], (err, results) => {
      if (err) return handleError(res, "Error fetching budgets", err);

      res.json(results);
      connection.end();
    });
  });
});

app.delete("/deleteBudget/:id", authenticateJWT, (req, res) => {
  const budgetId = req.params.id;
  const userId = req.user.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    // First verify the budget belongs to the user
    const checkQuery = "SELECT * FROM budgets WHERE id = ? AND user_id = ?";
    connection.query(checkQuery, [budgetId, userId], (err, results) => {
      if (err) return handleError(res, "Error checking budget ownership", err);

      if (results.length === 0) {
        return res
          .status(403)
          .json({ message: "Unauthorized to delete this budget" });
      }

      // Delete the budget
      const deleteQuery = "DELETE FROM budgets WHERE id = ? AND user_id = ?";
      connection.query(deleteQuery, [budgetId, userId], (err, result) => {
        if (err) return handleError(res, "Error deleting budget", err);

        res.json({ message: "Budget deleted successfully" });
        connection.end();
      });
    });
  });
});

// Add income routes
app.post("/updateIncome", authenticateJWT, (req, res) => {
  const { amount } = req.body;
  const userId = req.user.userId;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid income amount" });
  }

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    // Check if income exists for user
    const checkQuery = "SELECT * FROM income WHERE user_id = ?";
    connection.query(checkQuery, [userId], (err, results) => {
      if (err) return handleError(res, "Error checking existing income", err);

      if (results.length > 0) {
        // Update existing income
        const updateQuery = "UPDATE income SET amount = ? WHERE user_id = ?";
        connection.query(updateQuery, [amount, userId], (err) => {
          if (err) return handleError(res, "Error updating income", err);
          res.json({ message: "Income updated successfully" });
          connection.end();
        });
      } else {
        // Insert new income
        const insertQuery =
          "INSERT INTO income (user_id, amount) VALUES (?, ?)";
        connection.query(insertQuery, [userId, amount], (err) => {
          if (err) return handleError(res, "Error inserting income", err);
          res.json({ message: "Income added successfully" });
          connection.end();
        });
      }
    });
  });
});

app.get("/getIncome", authenticateJWT, (req, res) => {
  const userId = req.user.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT amount FROM income WHERE user_id = ?";
    connection.query(query, [userId], (err, results) => {
      if (err) return handleError(res, "Error fetching income", err);

      const income = results.length > 0 ? results[0].amount : 0;
      res.json({ income });
      connection.end();
    });
  });
});

// Get expenses for the current user
app.get("/getExpenses", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC";
    const connection = createConnection();

    connection.connect((err) => {
      if (err) return handleError(res, "Database connection error", err);

      connection.query(query, [userId], (err, results) => {
        if (err) {
          console.error("Error fetching expenses:", err);
          return handleError(res, "Error fetching expenses", err);
        }
        res.json(results);
        connection.end();
      });
    });
  } catch (error) {
    console.error("Error in getExpenses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Function to check if a category is budgeted
function isCategoryBudgeted(connection, userId, category) {
  return new Promise((resolve, reject) => {
    const query =
      "SELECT COUNT(*) as count FROM budgets WHERE user_id = ? AND category = ?";
    connection.query(query, [userId, category], (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results[0].count > 0);
    });
  });
}

// Add a new expense
app.post("/addExpense", authenticateJWT, async (req, res) => {
  try {
    const { date, description, category, amount } = req.body;
    const userId = req.user.userId;

    if (!date || !description || !category || !amount) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const connection = createConnection();
    connection.connect(async (err) => {
      if (err) return handleError(res, "Database connection error", err);

      try {
        // Check if the category is budgeted
        const isBudgeted = await isCategoryBudgeted(
          connection,
          userId,
          category
        );

        if (!isBudgeted) {
          connection.end();
          return res.status(400).json({
            message: `Cannot add expense: No budget found for category "${category}". Please add a budget for this category first.`,
          });
        }

        // If category is budgeted, proceed with adding the expense
        const query =
          "INSERT INTO expenses (user_id, date, description, category, amount) VALUES (?, ?, ?, ?, ?)";
        connection.query(
          query,
          [userId, date, description, category, amount],
          (err, result) => {
            if (err) {
              console.error("Error adding expense:", err);
              connection.end();
              return res.status(500).json({ message: "Error adding expense" });
            }
            res.status(201).json({ message: "Expense added successfully" });
            connection.end();
          }
        );
      } catch (error) {
        console.error("Error checking budget:", error);
        connection.end();
        return res.status(500).json({ message: "Error checking budget" });
      }
    });
  } catch (error) {
    console.error("Error in addExpense:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete an expense
app.delete("/deleteExpense/:id", authenticateJWT, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.user.userId;

    // First verify the expense belongs to the user
    const checkQuery = "SELECT user_id FROM expenses WHERE id = ?";
    const connection = createConnection();

    connection.connect((err) => {
      if (err) return handleError(res, "Database connection error", err);

      connection.query(checkQuery, [expenseId], (err, results) => {
        if (err) {
          console.error("Error checking expense ownership:", err);
          connection.end();
          return res
            .status(500)
            .json({ message: "Error checking expense ownership" });
        }

        if (results.length === 0) {
          connection.end();
          return res.status(404).json({ message: "Expense not found" });
        }

        if (results[0].user_id !== userId) {
          connection.end();
          return res
            .status(403)
            .json({ message: "Not authorized to delete this expense" });
        }

        // Delete the expense
        const deleteQuery = "DELETE FROM expenses WHERE id = ? AND user_id = ?";
        connection.query(deleteQuery, [expenseId, userId], (err, result) => {
          if (err) {
            console.error("Error deleting expense:", err);
            connection.end();
            return res.status(500).json({ message: "Error deleting expense" });
          }

          if (result.affectedRows === 0) {
            connection.end();
            return res.status(404).json({ message: "Expense not found" });
          }

          connection.end();
          res.json({ message: "Expense deleted successfully" });
        });
      });
    });
  } catch (error) {
    console.error("Error in deleteExpense:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Database functions

//1. authenticateUser
function authenticateUser(username, password, res) {
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT * FROM users WHERE username = ?";
    connection.query(query, [username], (err, results) => {
      if (err) return handleError(res, "Error querying data", err);

      if (results.length === 0) {
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      const user = results[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return handleError(res, "Error comparing passwords", err);

        if (!isMatch) {
          return res
            .status(401)
            .json({ message: "Invalid username or password" });
        }

        // Get user's income
        const incomeQuery = "SELECT amount FROM income WHERE user_id = ?";
        connection.query(incomeQuery, [user.id], (err, incomeResults) => {
          if (err) return handleError(res, "Error fetching income", err);

          const income = incomeResults.length > 0 ? incomeResults[0].amount : 0;

          const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
          );

          res.json({
            message: "Sign-in successful",
            token: token,
            userId: user.id,
            username: user.username,
            income: income,
          });
          connection.end();
        });
      });
    });
  });
}
//2. insertUserData
function insertUserData(username, email, password, res) {
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    // Check if username or email already exists
    const checkQuery = "SELECT * FROM users WHERE username = ? OR email = ?";
    connection.query(checkQuery, [username, email], (err, results) => {
      if (err) return handleError(res, "Error checking existing user", err);

      if (results.length > 0) {
        return res
          .status(400)
          .json({ message: "Username or email already exists" });
      }

      bcrypt.hash(password, 10, (err, hash) => {
        if (err) return handleError(res, "Error hashing password", err);

        const query =
          "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        connection.query(query, [username, email, hash], (err, result) => {
          if (err) return handleError(res, "Error inserting data", err);

          res.json({ message: "User registered successfully" });
          connection.end();
        });
      });
    });
  });
}

//3. insertBudgetData
function insertBudgetData(userId, frequency, category, amount, res) {
  if (!frequency || !category || !amount || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid budget data" });
  }

  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    // First check if the budget amount exceeds monthly income
    const incomeQuery = "SELECT amount FROM income WHERE user_id = ?";
    connection.query(incomeQuery, [userId], (err, incomeResults) => {
      if (err) return handleError(res, "Error checking income", err);

      const monthlyIncome =
        incomeResults.length > 0 ? incomeResults[0].amount : 0;
      const budgetAmount = parseFloat(amount);

      if (budgetAmount > monthlyIncome) {
        connection.end();
        return res.status(400).json({
          message: `Budget amount (Ksh ${budgetAmount.toFixed(
            2
          )}) cannot exceed your monthly income (Ksh ${monthlyIncome.toFixed(
            2
          )})`,
        });
      }

      // Check if budget for this category already exists
      const checkQuery =
        "SELECT * FROM budgets WHERE user_id = ? AND category = ?";
      connection.query(checkQuery, [userId, category], (err, results) => {
        if (err) return handleError(res, "Error checking existing budget", err);

        if (results.length > 0) {
          return res.status(400).json({
            message: `A budget for ${category} already exists. Please update the existing budget instead.`,
          });
        }

        // If no existing budget found, insert the new one
        const query =
          "INSERT INTO budgets (user_id, frequency, category, amount) VALUES (?, ?, ?, ?)";
        connection.query(
          query,
          [userId, frequency, category, amount],
          (err, result) => {
            if (err) return handleError(res, "Error inserting data", err);

            res.json({ message: "Budget added successfully" });
            connection.end();
          }
        );
      });
    });
  });
}

//4. Expense routes
function addExpenseData(userId, date, description, category, amount, res) {
  if (!date || !description || !category || !amount || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid expense data" });
  }

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);
    //check if expense for this category already exists
    const checkQuery =
      "SELECT * FROM expenses WHERE user_id = ? AND category = ?";
    connection.query(checkQuery, [userId, category], (err, results) => {
      if (err) return handleError(res, "Error checking existing expense", err);
      if (results.length > 0) {
        return res.status(400).json({
          message: `An expense for ${category} already exists. Please update the existing expense instead.`,
        });
      }
      //if no existing expense found, insert the new one
      const query =
        "INSERT INTO expenses (user_id, date, description, category, amount) VALUES (?, ?, ?, ?, ?)";
      connection.query(
        query,
        [userId, date, description, category, amount],
        (err, result) => {
          if (err) return handleError(res, "Error inserting data", err);
          res.json({ message: "Expense added successfully" });
          connection.end();
        }
      );
    });
  });
}

//5. getExpensesData
function getExpensesData(userId, res) {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);
    const query = "SELECT * FROM expenses WHERE user_id = ?";
    connection.query(query, [userId], (err, results) => {
      if (err) return handleError(res, "Error fetching expenses", err);
      res.json(results);
      connection.end();
    });
  });
}

//6. deleteExpenseData
function deleteExpenseData(expenseId, res) {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);
    const query = "DELETE FROM expenses WHERE id = ?";
    connection.query(query, [expenseId], (err, result) => {
      if (err) return handleError(res, "Error deleting expense", err);
      res.json({ message: "Expense deleted successfully" });
      connection.end();
    });
  });
}

//7. updateExpenseData
function updateExpenseData(
  expenseId,
  date,
  description,
  category,
  amount,
  res
) {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);
    const query =
      "UPDATE expenses SET date = ?, description = ?, category = ?, amount = ? WHERE id = ?";
    connection.query(
      query,
      [date, description, category, amount, expenseId],
      (err, result) => {
        if (err) return handleError(res, "Error updating expense", err);
        res.json({ message: "Expense updated successfully" });
        connection.end();
      }
    );
  });
}

//8. getExpenseSummaryData
function getExpenseSummaryData(userId, res) {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);
    const query =
      "SELECT SUM(amount) as total_amount FROM expenses WHERE user_id = ?";
    connection.query(query, [userId], (err, results) => {
      if (err) return handleError(res, "Error fetching expense summary", err);
      res.json(results[0]);
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
    database: process.env.DB_NAME,
  });
}

function handleError(res, message, err) {
  console.error(message, err);
  res.status(500).json({ message: "Internal server error" });
}

function sendInvalidCredentials(res) {
  res.status(401).json({ message: "Invalid username or password" });
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
      frequency VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS income (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
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
