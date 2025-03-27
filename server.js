// Required modules
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const WebSocket = require("ws");
const fs = require("fs");
require("dotenv").config();

// Initialize database pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Initialize WebSocket server with error handling
let wss;
try {
  wss = new WebSocket.Server({ port: 8081 }); // Changed port to 8081
  wss.on("connection", (ws) => {
    console.log("Client connected");
    ws.on("close", () => console.log("Client disconnected"));
  });
} catch (error) {
  console.error("WebSocket server initialization error:", error);
  // Continue without WebSocket functionality
}

function broadcastIncomeUpdate(userId, amount) {
  if (!wss) return; // Skip if WebSocket server is not initialized
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ userId, amount }));
    }
  });
}

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

// Database Connection Helper
function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

// Error Handler
function handleError(res, message, err) {
  console.error(message, err);
  res.status(500).json({ message: "Internal server error" });
}

// ====================================
// BASIC ROUTES
// ====================================

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.get("/home", (req, res) => {
  res.sendFile(__dirname + "/homepage.html");
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ====================================
// AUTHENTICATION ROUTES & FUNCTIONS
// ====================================

app.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  console.log("Received signup request for username:", username);

  if (!username || !email || !password) {
    console.log("Missing required fields");
    return res.status(400).json({ message: "All fields are required" });
  }

  insertUserData(username, email, password, res);
});

app.post("/signin", async (req, res) => {
  const { username, password } = req.body;
  console.log("Sign-in attempt for user:", username);

  if (!username || !password) {
    console.log("Missing credentials in sign-in request");
    return res.status(400).json({
      success: false,
      message: "Username and password are required",
    });
  }

  try {
    const result = await authenticateUser(username, password);
    if (result.success) {
      console.log("Successful sign-in for user:", username);
      res.json({
        success: true,
        token: result.token,
        userId: result.userId,
        username: result.username,
        settings: result.settings,
      });
    } else {
      console.log(
        "Failed sign-in attempt for user:",
        username,
        "Reason:",
        result.message
      );
      res.status(401).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Error during sign-in:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during sign-in",
    });
  }
});

// Verify token endpoint
app.get("/api/verify-token", authenticateJWT, (req, res) => {
  res.json({
    valid: true,
    userId: req.user.userId,
    username: req.user.username,
  });
});

async function authenticateUser(username, password) {
  try {
    const connection = await pool.promise().getConnection();
    console.log("Database connection established for authentication");

    try {
      const [users] = await connection.query(
        "SELECT * FROM users WHERE username = ?",
        [username]
      );

      if (users.length === 0) {
        console.log("No user found with username:", username);
        return {
          success: false,
          message: "Invalid username or password",
        };
      }

      const user = users[0];
      console.log("User found, verifying password");

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        console.log("Password mismatch for user:", username);
        return {
          success: false,
          message: "Invalid username or password",
        };
      }

      console.log("Password verified successfully for user:", username);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Get user settings
      const [settings] = await connection.query(
        "SELECT * FROM user_settings WHERE user_id = ?",
        [user.id]
      );

      console.log(
        "Generated JWT token and retrieved settings for user:",
        username
      );

      return {
        success: true,
        token,
        userId: user.id,
        username: user.username,
        settings: settings[0] || null,
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Database error during authentication:", error);
    throw error;
  }
}

function insertUserData(username, email, password, res) {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) {
      console.error("Database connection error:", err);
      return res.status(500).json({ message: "Database connection error" });
    }

    console.log("Checking for existing user");
    const checkQuery = "SELECT * FROM users WHERE username = ? OR email = ?";
    connection.query(checkQuery, [username, email], (err, results) => {
      if (err) {
        console.error("Error checking existing user:", err);
        connection.end();
        return res
          .status(500)
          .json({ message: "Error checking existing user" });
      }

      if (results.length > 0) {
        console.log("Username or email already exists");
        connection.end();
        return res
          .status(400)
          .json({ message: "Username or email already exists" });
      }

      console.log("Hashing password");
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
          connection.end();
          return res.status(500).json({ message: "Error processing password" });
        }

        console.log("Inserting new user");
        const query =
          "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        connection.query(query, [username, email, hash], (err, result) => {
          if (err) {
            console.error("Error inserting user:", err);
            connection.end();
            return res.status(500).json({ message: "Error creating user" });
          }

          console.log("User created successfully");
          connection.end();
          res.json({ message: "User registered successfully" });
        });
      });
    });
  });
}

// ====================================
// BUDGET ROUTES & FUNCTIONS
// ====================================

app.post("/api/budgets", authenticateJWT, (req, res) => {
  const { frequency, category, amount } = req.body;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;

  if (!frequency || !category || !amount || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid budget data" });
  }

  insertBudgetData(userId, frequency, category, amount, res, ip);
});

app.get("/api/budgets/:userId", authenticateJWT, (req, res) => {
  const userId = req.params.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT * FROM budgets WHERE user_id = ?";
    connection.query(query, [userId], (err, budgets) => {
      if (err) {
        console.error("Error fetching budgets:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to fetch budgets" });
      }

      res.json(budgets);
      connection.end();
    });
  });
});

app.delete("/api/budgets/:id", authenticateJWT, (req, res) => {
  const budgetId = req.params.id;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;
  deleteBudgetData(budgetId, userId, res, ip);
});

function insertBudgetData(userId, frequency, category, amount, res, ip) {
  if (!frequency || !category || !amount || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid budget data" });
  }

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const incomeQuery = "SELECT amount FROM income WHERE user_id = ?";
    connection.query(incomeQuery, [userId], (err, incomeResults) => {
      if (err) return handleError(res, "Error checking income", err);

      const monthlyIncome =
        incomeResults.length > 0 ? incomeResults[0].amount : 0;
      const budgetAmount = parseFloat(amount);

      if (budgetAmount > monthlyIncome) {
        connection.end();
        logUserActivity(
          userId,
          "BUDGET_ERROR",
          `Attempted to add budget (${category}: KES ${budgetAmount}) exceeding income (KES ${monthlyIncome})`,
          ip
        );
        return res.status(400).json({
          message: `Budget amount (KES ${budgetAmount.toFixed(
            2
          )}) cannot exceed your monthly income (KES ${monthlyIncome.toFixed(
            2
          )})`,
        });
      }

      const checkQuery =
        "SELECT * FROM budgets WHERE user_id = ? AND category = ?";
      connection.query(checkQuery, [userId, category], (err, results) => {
        if (err) return handleError(res, "Error checking existing budget", err);

        if (results.length > 0) {
          logUserActivity(
            userId,
            "BUDGET_ERROR",
            `Attempted to add duplicate budget for category: ${category}`,
            ip
          );
          return res.status(400).json({
            message: `A budget for ${category} already exists. Please update the existing budget instead.`,
          });
        }

        const query =
          "INSERT INTO budgets (user_id, frequency, category, amount) VALUES (?, ?, ?, ?)";
        connection.query(
          query,
          [userId, frequency, category, amount],
          (err, result) => {
            if (err) return handleError(res, "Error inserting data", err);

            logUserActivity(
              userId,
              "BUDGET_ADDED",
              `Added new budget - Category: ${category}, Amount: KES ${amount}, Frequency: ${frequency}`,
              ip
            );
            res.json({ message: "Budget added successfully" });
            connection.end();
          }
        );
      });
    });
  });
}

function deleteBudgetData(budgetId, userId, res, ip) {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "DELETE FROM budgets WHERE id = ? AND user_id = ?";
    connection.query(query, [budgetId, userId], (err, result) => {
      if (err) {
        console.error("Error deleting budget:", err);
        connection.end();
        return handleError(res, "Failed to delete budget", err);
      }

      if (result.affectedRows === 0) {
        connection.end();
        return res.status(404).json({ message: "Budget not found" });
      }

      logUserActivity(
        userId,
        "BUDGET_DELETED",
        `Deleted budget - ID: ${budgetId}`,
        ip
      );

      res.json({ message: "Budget deleted successfully" });
      connection.end();
    });
  });
}

// ====================================
// EXPENSE ROUTES & FUNCTIONS
// ====================================

app.post("/api/expenses", authenticateJWT, (req, res) => {
  const { date, description, category, amount } = req.body;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;

  if (!date || !description || !category || !amount) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const incomeQuery = "SELECT amount FROM income WHERE user_id = ?";
    connection.query(incomeQuery, [userId], (err, incomeResults) => {
      if (err) {
        connection.end();
        return handleError(res, "Error checking income", err);
      }

      const income =
        incomeResults.length > 0 ? parseFloat(incomeResults[0].amount) : 0;

      const expensesQuery =
        "SELECT SUM(amount) as total FROM expenses WHERE user_id = ?";
      connection.query(expensesQuery, [userId], (err, expenseResults) => {
        if (err) {
          connection.end();
          return handleError(res, "Error checking existing expenses", err);
        }

        const currentExpenseTotal = expenseResults[0].total
          ? parseFloat(expenseResults[0].total)
          : 0;
        const newTotal = currentExpenseTotal + parseFloat(amount);

        if (newTotal > income) {
          connection.end();
          logUserActivity(
            userId,
            "EXPENSE_ERROR",
            `Attempted to add expense (${category}: KES ${amount}) that would exceed income (KES ${income})`,
            ip
          );
          return res.status(400).json({
            message: `Adding this expense would exceed your monthly income. 
            Total expenses would be KES ${newTotal.toFixed(
              2
            )}, but your income is KES ${income.toFixed(2)}.`,
          });
        }

        const checkBudgetQuery =
          "SELECT * FROM budgets WHERE user_id = ? AND category = ?";
        connection.query(
          checkBudgetQuery,
          [userId, category],
          (err, budgetResults) => {
            if (err) {
              connection.end();
              return handleError(res, "Error checking budget", err);
            }

            if (budgetResults.length === 0) {
              connection.end();
              logUserActivity(
                userId,
                "EXPENSE_ERROR",
                `Attempted to add expense for unbudgeted category: ${category}`,
                ip
              );
              return res.status(400).json({
                message: `No budget found for category '${category}'. Please add a budget first.`,
              });
            }

            const budget = parseFloat(budgetResults[0].amount);

            const categoryExpensesQuery =
              "SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND category = ?";
            connection.query(
              categoryExpensesQuery,
              [userId, category],
              (err, categoryExpenseResults) => {
                if (err) {
                  connection.end();
                  return handleError(
                    res,
                    "Error checking category expenses",
                    err
                  );
                }

                const currentCategoryTotal = categoryExpenseResults[0].total
                  ? parseFloat(categoryExpenseResults[0].total)
                  : 0;
                const newCategoryTotal =
                  currentCategoryTotal + parseFloat(amount);

                if (newCategoryTotal > budget) {
                  connection.end();
                  logUserActivity(
                    userId,
                    "EXPENSE_ERROR",
                    `Attempted to add expense (${category}: KES ${amount}) that would exceed category budget (KES ${budget})`,
                    ip
                  );
                  return res.status(400).json({
                    message: `This expense would exceed your budget for ${category}. 
                    Budget limit: KES ${budget.toFixed(2)}, 
                    Current total: KES ${currentCategoryTotal.toFixed(2)}, 
                    This expense: KES ${parseFloat(amount).toFixed(2)}, 
                    Would exceed by: KES ${(newCategoryTotal - budget).toFixed(
                      2
                    )}`,
                    error: "budget_exceeded",
                    categoryBudget: budget,
                    currentCategoryTotal: currentCategoryTotal,
                    newCategoryTotal: newCategoryTotal,
                  });
                }

                const query =
                  "INSERT INTO expenses (user_id, date, description, category, amount) VALUES (?, ?, ?, ?, ?)";
                connection.query(
                  query,
                  [userId, date, description, category, amount],
                  (err, result) => {
                    if (err) {
                      connection.end();
                      return handleError(res, "Error adding expense", err);
                    }

                    logUserActivity(
                      userId,
                      "EXPENSE_ADDED",
                      `Added expense - Category: ${category}, Amount: KES ${amount}, Description: ${description}`,
                      ip
                    );

                    res.json({
                      message: "Expense added successfully",
                      budgetExceeded: newCategoryTotal > budget,
                      categoryBudget: budget,
                      categoryTotal: newCategoryTotal,
                    });

                    connection.end();
                  }
                );
              }
            );
          }
        );
      });
    });
  });
});

app.get("/api/expenses/:userId", authenticateJWT, (req, res) => {
  const userId = req.params.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC";
    connection.query(query, [userId], (err, expenses) => {
      if (err) {
        console.error("Error fetching expenses:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to fetch expenses" });
      }

      const categoryGroups = {};
      const categoryTotals = {};
      const categoryCounts = {};
      let totalExpenses = 0;

      expenses.forEach((expense) => {
        const category = expense.category;

        if (!categoryGroups[category]) {
          categoryGroups[category] = [];
          categoryTotals[category] = 0;
          categoryCounts[category] = 0;
        }

        categoryGroups[category].push(expense);
        categoryTotals[category] += parseFloat(expense.amount);
        categoryCounts[category]++;
        totalExpenses += parseFloat(expense.amount);
      });

      res.json({
        expenses: expenses,
        categoryGroups: categoryGroups,
        categoryTotals: categoryTotals,
        categoryCounts: categoryCounts,
        totalExpenses: totalExpenses,
      });

      connection.end();
    });
  });
});

app.delete("/api/expenses/:id", authenticateJWT, (req, res) => {
  const expenseId = req.params.id;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;
  deleteExpenseData(expenseId, userId, res, ip);
});

function deleteExpenseData(expenseId, userId, res, ip) {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const checkQuery = "SELECT * FROM expenses WHERE id = ? AND user_id = ?";
    connection.query(checkQuery, [expenseId, userId], (err, results) => {
      if (err) return handleError(res, "Error checking expense ownership", err);

      if (results.length === 0) {
        connection.end();
        return res.status(404).json({ message: "Expense not found" });
      }

      const query = "DELETE FROM expenses WHERE id = ? AND user_id = ?";
      connection.query(query, [expenseId, userId], (err, result) => {
        if (err) return handleError(res, "Error deleting expense", err);

        logUserActivity(
          userId,
          "EXPENSE_DELETED",
          `Deleted expense - ID: ${expenseId}`,
          ip
        );

        res.json({ message: "Expense deleted successfully" });
        connection.end();
      });
    });
  });
}

// ====================================
// INCOME ROUTES & FUNCTIONS
// ====================================

app.post("/api/income", authenticateJWT, (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.userId;
    const ip = req.ip || req.connection.remoteAddress;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ message: "Invalid income amount" });
    }

    const connection = createConnection();
    connection.connect((err) => {
      if (err) {
        console.error("Database connection error:", err);
        return res.status(500).json({ error: "Database connection failed" });
      }

      const checkQuery = "SELECT * FROM income WHERE user_id = ?";
      connection.query(checkQuery, [userId], (err, results) => {
        if (err) {
          console.error("Error checking existing income:", err);
          connection.end();
          return res
            .status(500)
            .json({ error: "Failed to check existing income" });
        }

        const query =
          results.length > 0
            ? "UPDATE income SET amount = ? WHERE user_id = ?"
            : "INSERT INTO income (user_id, amount) VALUES (?, ?)";

        const params = results.length > 0 ? [amount, userId] : [userId, amount];

        connection.query(query, params, (err) => {
          if (err) {
            console.error("Error updating income:", err);
            connection.end();
            return res.status(500).json({ error: "Failed to update income" });
          }

          logUserActivity(
            userId,
            results.length > 0 ? "INCOME_UPDATED" : "INCOME_ADDED",
            `${results.length > 0 ? "Updated" : "Added"} income: KES ${amount}`,
            ip
          );

          res.json({ message: "Income updated successfully", amount });
          connection.end();
        });
      });
    });
  } catch (error) {
    console.error("Error in /api/income:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/income", authenticateJWT, (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = createConnection();

    connection.connect((err) => {
      if (err) {
        console.error("Database connection error:", err);
        return res.status(500).json({ error: "Database connection failed" });
      }

      const query = "SELECT amount FROM income WHERE user_id = ?";
      connection.query(query, [userId], (err, results) => {
        if (err) {
          console.error("Error fetching income:", err);
          connection.end();
          return res.status(500).json({ error: "Failed to fetch income" });
        }

        const income = results.length > 0 ? results[0].amount : 0;
        const modified_at = new Date().toISOString();

        res.json({ income, modified_at });
        connection.end();
      });
    });
  } catch (error) {
    console.error("Error in /api/income:", error);
    res.status(500).json({ error: "Internal server error" });
  }
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
  const { date, description, category, amount } = req.body;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;

  if (!date || !description || !category || !amount) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    // First check if there's a budget for this category
    const checkBudgetQuery =
      "SELECT * FROM budgets WHERE user_id = ? AND category = ?";
    connection.query(
      checkBudgetQuery,
      [userId, category],
      (err, budgetResults) => {
        if (err) return handleError(res, "Error checking budget", err);

        if (budgetResults.length === 0) {
          logUserActivity(
            userId,
            "EXPENSE_ERROR",
            `Attempted to add expense for unbudgeted category: ${category}`,
            ip
          );
          return res.status(400).json({
            message: `No budget found for category '${category}'. Please add a budget first.`,
          });
        }

        const query =
          "INSERT INTO expenses (user_id, date, description, category, amount) VALUES (?, ?, ?, ?, ?)";
        connection.query(
          query,
          [userId, date, description, category, amount],
          (err, result) => {
            if (err) return handleError(res, "Error adding expense", err);

            logUserActivity(
              userId,
              "EXPENSE_ADDED",
              `Added expense - Category: ${category}, Amount: Ksh ${amount}, Description: ${description}`,
              ip
            );
            res.json({ message: "Expense added successfully" });
            connection.end();
          }
        );
      }
    );
  });
});

// Get budgets for a specific user
app.get("/getBudgets/:userId", authenticateJWT, (req, res) => {
  const userId = req.params.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT category, amount FROM budgets WHERE user_id = ?";
    connection.query(query, [userId], (err, budgets) => {
      if (err) {
        console.error("Error fetching budgets:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to fetch budgets" });
      }

      res.json(budgets);
      connection.end();
    });
  });
});

// Get expenses for a specific user
app.get("/getExpenses/:userId", authenticateJWT, (req, res) => {
  const userId = req.params.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT category, amount FROM expenses WHERE user_id = ?";
    connection.query(query, [userId], (err, expenses) => {
      if (err) {
        console.error("Error fetching expenses:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to fetch expenses" });
      }

      res.json(expenses);
      connection.end();
    });
  });
});

// ====================================
// DASHBOARD & REPORT ROUTES
// ====================================

app.get("/api/dashboardSummary/:userId", authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (req.user.userId !== parseInt(userId)) {
      return res
        .status(403)
        .json({ error: "Unauthorized access to dashboard data" });
    }

    const connection = createConnection();
    connection.connect((err) => {
      if (err) {
        console.error("Database connection error:", err);
        return handleError(res, "Database connection failed", res, err);
      }

      const budgetQuery =
        "SELECT SUM(amount) as totalBudgeted FROM budgets WHERE user_id = ?";
      connection.query(budgetQuery, [userId], (err, budgetResult) => {
        if (err) {
          console.error("Error fetching budget total:", err);
          connection.end();
          return handleError(res, "Failed to fetch budget data", res, err);
        }

        const totalBudgeted = budgetResult[0].totalBudgeted || 0;

        const expenseQuery =
          "SELECT SUM(amount) as totalExpenses FROM expenses WHERE user_id = ?";
        connection.query(expenseQuery, [userId], (err, expenseResult) => {
          if (err) {
            console.error("Error fetching expense total:", err);
            connection.end();
            return handleError(res, "Failed to fetch expense data", res, err);
          }

          const totalExpenses = expenseResult[0].totalExpenses || 0;

          const incomeQuery = "SELECT amount FROM income WHERE user_id = ?";
          connection.query(incomeQuery, [userId], (err, incomeResult) => {
            if (err) {
              console.error("Error fetching income:", err);
              connection.end();
              return handleError(res, "Failed to fetch income data", res, err);
            }

            const income = incomeResult.length > 0 ? incomeResult[0].amount : 0;
            const remainingBudget = income - totalExpenses;

            res.json({
              income,
              totalBudgeted,
              totalExpenses,
              remainingBudget,
              lastUpdated: new Date().toISOString(),
            });

            connection.end();
          });
        });
      });
    });
  } catch (error) {
    console.error("Error in /api/dashboardSummary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/reports/:userId", authenticateJWT, async (req, res) => {
  const userId = req.params.userId;

  try {
    const connection = createConnection();
    connection.connect();

    const monthlyQuery = `
      SELECT DATE_FORMAT(date, '%Y-%m') AS month, SUM(amount) AS total
      FROM expenses
      WHERE user_id = ?
      GROUP BY month
      ORDER BY month DESC
    `;
    const [monthlyData] = await connection
      .promise()
      .query(monthlyQuery, [userId]);

    const categoryQuery = `
      SELECT category, SUM(amount) AS total
      FROM expenses
      WHERE user_id = ?
      GROUP BY category
      ORDER BY total DESC
    `;
    const [categoryData] = await connection
      .promise()
      .query(categoryQuery, [userId]);

    connection.end();

    res.json({ monthlyData, categoryData });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// ====================================
// EXPORT ROUTES & FUNCTIONS
// ====================================

app.get("/api/export/pdf", authenticateJWT, async (req, res) => {
  const userId = req.user.userId;
  const connection = createConnection();

  try {
    const expensesQuery = `
      SELECT 
        date, 
        description, 
        category, 
        CAST(amount AS DECIMAL(10,2)) as amount, 
        updated_at
      FROM expenses 
      WHERE user_id = ? 
      ORDER BY date DESC
    `;

    const budgetsQuery = `
      SELECT 
        frequency, 
        category, 
        CAST(amount AS DECIMAL(10,2)) as amount, 
        updated_at
      FROM budgets 
      WHERE user_id = ? 
      ORDER BY category
    `;

    const incomeQuery =
      "SELECT CAST(amount AS DECIMAL(10,2)) as amount FROM income WHERE user_id = ?";

    connection.query(expensesQuery, [userId], (err, expenses) => {
      if (err) {
        connection.end();
        return handleError(res, "Error fetching expenses", err);
      }

      connection.query(budgetsQuery, [userId], (err, budgets) => {
        if (err) {
          connection.end();
          return handleError(res, "Error fetching budgets", err);
        }

        connection.query(incomeQuery, [userId], (err, income) => {
          if (err) {
            connection.end();
            return handleError(res, "Error fetching income", err);
          }

          try {
            const doc = new PDFDocument({
              margins: { top: 50, bottom: 50, left: 50, right: 50 },
              info: {
                Title: "Financial Report",
                Author: "Finance Tracker",
                Subject: "Expenses and Budgets Report",
                Keywords: "expenses, budgets, finance, report",
              },
            });

            const filename = `financial_report_${Date.now()}.pdf`;

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
              "Content-Disposition",
              `attachment; filename=${filename}`
            );

            doc.pipe(res);

            const colors = {
              primary: "#5995fd",
              primaryLight: "#04befe",
              primaryDark: "#4481eb",
              secondary: "#04befe",
              accent: "#ff7e5f",
              success: "#25db97",
              danger: "#ff4d6d",
              warning: "#ffd166",
              dark: "#333333",
              light: "#f9fafb",
              gray: "#6b7280",
            };

            // Header
            doc.rect(0, 0, doc.page.width, 120).fill(colors.primary);

            doc
              .font("Helvetica-Bold")
              .fontSize(28)
              .fillColor("white")
              .text("FINANCIAL REPORT", 50, 50, { align: "center" });

            doc
              .fontSize(14)
              .fillColor("white")
              .text(`Generated on ${new Date().toLocaleDateString()}`, 50, 85, {
                align: "center",
              });

            doc.moveDown(3);

            // Income section
            const incomeAmount =
              income.length > 0 ? Number(income[0].amount) : 0;
            doc
              .font("Helvetica-Bold")
              .fontSize(16)
              .fillColor(colors.dark)
              .text("Income Summary", { align: "left" });

            doc.moveDown(0.5);

            // Income table
            doc.font("Helvetica").fontSize(12).fillColor(colors.dark);
            const incomeTableTop = doc.y + 10;
            doc.rect(50, incomeTableTop, 500, 30).fill(colors.primaryLight);

            doc
              .fillColor("white")
              .text("Total Monthly Income", 60, incomeTableTop + 10);

            doc.text(
              `KES ${incomeAmount.toFixed(2)}`,
              400,
              incomeTableTop + 10,
              { width: 140, align: "right" }
            );

            doc.moveDown(2);

            // Budget section
            doc
              .font("Helvetica-Bold")
              .fontSize(16)
              .fillColor(colors.dark)
              .text("Budget Summary", { align: "left" });

            doc.moveDown(0.5);

            if (budgets.length === 0) {
              doc
                .font("Helvetica")
                .fontSize(12)
                .fillColor(colors.gray)
                .text("No budgets defined.", { align: "left" });
            } else {
              // Budget table header
              const budgetTableTop = doc.y + 10;
              doc.rect(50, budgetTableTop, 500, 30).fill(colors.primaryDark);

              doc
                .fillColor("white")
                .text("Category", 60, budgetTableTop + 10)
                .text("Frequency", 200, budgetTableTop + 10)
                .text("Amount", 300, budgetTableTop + 10)
                .text("Last Modified", 400, budgetTableTop + 10);

              // Budget rows
              let budgetY = budgetTableTop + 30;
              let totalBudget = 0;

              budgets.forEach((budget, index) => {
                if (budgetY > 700) {
                  doc.addPage();
                  budgetY = 50;
                }

                doc
                  .rect(50, budgetY, 500, 25)
                  .fill(index % 2 === 0 ? "#f9fafb" : "#f0f0f0");

                const budgetAmount = Number(budget.amount);
                totalBudget += budgetAmount;

                doc
                  .fillColor(colors.dark)
                  .text(budget.category, 60, budgetY + 7)
                  .text(budget.frequency, 200, budgetY + 7)
                  .text(`KES ${budgetAmount.toFixed(2)}`, 300, budgetY + 7);

                const updatedDate = budget.updated_at
                  ? new Date(budget.updated_at).toLocaleDateString()
                  : "Not modified";

                doc.text(updatedDate, 400, budgetY + 7);

                budgetY += 25;
              });

              // Budget total
              doc.rect(50, budgetY, 500, 30).fill(colors.secondary);
              doc
                .fillColor("white")
                .font("Helvetica-Bold")
                .text("Total Budgeted", 60, budgetY + 10)
                .text(`KES ${totalBudget.toFixed(2)}`, 300, budgetY + 10);
            }

            doc.moveDown(2);

            // Expenses section
            doc
              .font("Helvetica-Bold")
              .fontSize(16)
              .fillColor(colors.dark)
              .text("Expense Transactions", { align: "left" });

            doc.moveDown(0.5);

            if (expenses.length === 0) {
              doc
                .font("Helvetica")
                .fontSize(12)
                .fillColor(colors.gray)
                .text("No expenses recorded.", { align: "left" });
            } else {
              // Expense table header
              const expenseTableTop = doc.y + 10;
              doc.rect(50, expenseTableTop, 500, 30).fill(colors.accent);

              doc
                .fillColor("white")
                .text("Date", 60, expenseTableTop + 10)
                .text("Description", 140, expenseTableTop + 10)
                .text("Category", 280, expenseTableTop + 10)
                .text("Amount", 380, expenseTableTop + 10)
                .text("Last Modified", 440, expenseTableTop + 10);

              // Expense rows
              let expenseY = expenseTableTop + 30;
              let totalExpenses = 0;

              expenses.forEach((expense, index) => {
                if (expenseY > 700) {
                  doc.addPage();
                  expenseY = 50;

                  doc.rect(50, expenseY, 500, 30).fill(colors.accent);

                  doc
                    .fillColor("white")
                    .text("Date", 60, expenseY + 10)
                    .text("Description", 140, expenseY + 10)
                    .text("Category", 280, expenseY + 10)
                    .text("Amount", 380, expenseY + 10)
                    .text("Last Modified", 440, expenseY + 10);

                  expenseY += 30;
                }

                doc
                  .rect(50, expenseY, 500, 25)
                  .fill(index % 2 === 0 ? "#f9fafb" : "#f0f0f0");

                const expenseAmount = Number(expense.amount);
                totalExpenses += expenseAmount;

                doc
                  .fillColor(colors.dark)
                  .text(
                    new Date(expense.date).toLocaleDateString(),
                    60,
                    expenseY + 7
                  )
                  .text(expense.description, 140, expenseY + 7, { width: 140 })
                  .text(expense.category, 280, expenseY + 7)
                  .text(`KES ${expenseAmount.toFixed(2)}`, 380, expenseY + 7);

                const updatedDate = expense.updated_at
                  ? new Date(expense.updated_at).toLocaleDateString()
                  : "Not modified";

                doc.text(updatedDate, 440, expenseY + 7);

                expenseY += 25;
              });

              // Total expenses row
              doc.rect(50, expenseY, 500, 30).fill(colors.danger);
              doc
                .fillColor("white")
                .font("Helvetica-Bold")
                .text("Total Expenses", 60, expenseY + 10)
                .text(`KES ${totalExpenses.toFixed(2)}`, 380, expenseY + 10);

              expenseY += 40;

              // Summary section
              if (expenseY > 650) {
                doc.addPage();
                expenseY = 50;
              }

              // Final summary
              doc
                .rect(50, expenseY, 500, 90)
                .lineWidth(1)
                .stroke(colors.primary);

              doc
                .font("Helvetica-Bold")
                .fontSize(14)
                .fillColor(colors.primary)
                .text("Financial Summary", 60, expenseY + 10);

              doc
                .font("Helvetica")
                .fontSize(12)
                .fillColor(colors.dark)
                .text(
                  `Total Income: KES ${incomeAmount.toFixed(2)}`,
                  60,
                  expenseY + 35
                )
                .text(
                  `Total Expenses: KES ${totalExpenses.toFixed(2)}`,
                  60,
                  expenseY + 55
                );

              const balance = incomeAmount - totalExpenses;

              doc
                .font("Helvetica-Bold")
                .fillColor(balance >= 0 ? colors.success : colors.danger)
                .text(
                  `Remaining Balance: KES ${balance.toFixed(2)}`,
                  60,
                  expenseY + 75
                );
            }

            // Footer with page numbers
            const range = doc.bufferedPageRange();
            const totalPages = range.count;

            for (let i = range.start; i < range.start + totalPages; i++) {
              doc.switchToPage(i);

              doc
                .font("Helvetica")
                .fontSize(10)
                .fillColor(colors.gray)
                .text(
                  `Page ${i + 1} of ${totalPages}`,
                  50,
                  doc.page.height - 50,
                  { align: "center", width: doc.page.width - 100 }
                );
            }

            doc.end();
          } catch (error) {
            console.error("Error generating PDF:", error);
            res.status(500).json({ error: "Failed to generate PDF" });
          }
          connection.end();
        });
      });
    });
  } catch (error) {
    connection.end();
    return handleError(res, "Error generating PDF", error);
  }
});

app.get("/api/export/excel", authenticateJWT, async (req, res) => {
  const userId = req.user.userId;
  const connection = createConnection();

  try {
    const expensesQuery = `
      SELECT 
        date, 
        description, 
        category, 
        CAST(amount AS DECIMAL(10,2)) as amount, 
        updated_at
      FROM expenses 
      WHERE user_id = ? 
      ORDER BY date DESC
    `;

    const budgetsQuery = `
      SELECT 
        frequency, 
        category, 
        CAST(amount AS DECIMAL(10,2)) as amount, 
        updated_at
      FROM budgets 
      WHERE user_id = ? 
      ORDER BY category
    `;

    const incomeQuery =
      "SELECT CAST(amount AS DECIMAL(10,2)) as amount FROM income WHERE user_id = ?";

    connection.query(expensesQuery, [userId], (err, expenses) => {
      if (err) {
        connection.end();
        return handleError(res, "Error fetching expenses", err);
      }

      connection.query(budgetsQuery, [userId], (err, budgets) => {
        if (err) {
          connection.end();
          return handleError(res, "Error fetching budgets", err);
        }

        connection.query(incomeQuery, [userId], (err, income) => {
          if (err) {
            connection.end();
            return handleError(res, "Error fetching income", err);
          }

          try {
            // Format data for Excel
            const formattedExpenses = expenses.map((expense) => ({
              Date: new Date(expense.date).toLocaleDateString(),
              Description: expense.description,
              Category: expense.category,
              Amount: Number(expense.amount).toFixed(2),
              "Last Modified": expense.updated_at
                ? new Date(expense.updated_at).toLocaleDateString()
                : "Not modified",
            }));

            const formattedBudgets = budgets.map((budget) => ({
              Category: budget.category,
              Frequency: budget.frequency,
              Amount: Number(budget.amount).toFixed(2),
              "Last Modified": budget.updated_at
                ? new Date(budget.updated_at).toLocaleDateString()
                : "Not modified",
            }));

            // Create workbook and worksheets
            const wb = XLSX.utils.book_new();

            // Add expenses worksheet
            if (formattedExpenses.length > 0) {
              const expensesWs = XLSX.utils.json_to_sheet(formattedExpenses);
              XLSX.utils.book_append_sheet(wb, expensesWs, "Expenses");
              formatExcelSheet(expensesWs);
            } else {
              const expensesWs = XLSX.utils.aoa_to_sheet([
                ["No expenses found"],
              ]);
              XLSX.utils.book_append_sheet(wb, expensesWs, "Expenses");
            }

            // Add budgets worksheet
            if (formattedBudgets.length > 0) {
              const budgetsWs = XLSX.utils.json_to_sheet(formattedBudgets);
              XLSX.utils.book_append_sheet(wb, budgetsWs, "Budgets");
              formatExcelSheet(budgetsWs);
            } else {
              const budgetsWs = XLSX.utils.aoa_to_sheet([["No budgets found"]]);
              XLSX.utils.book_append_sheet(wb, budgetsWs, "Budgets");
            }

            // Add summary information
            const incomeAmount =
              income.length > 0 ? Number(income[0].amount) : 0;
            const totalExpenses = expenses.reduce(
              (sum, expense) => sum + Number(expense.amount),
              0
            );
            const totalBudgeted = budgets.reduce(
              (sum, budget) => sum + Number(budget.amount),
              0
            );

            // Add summary worksheet
            const summaryData = [
              { Summary: "Total Income", Amount: incomeAmount.toFixed(2) },
              { Summary: "Total Expenses", Amount: totalExpenses.toFixed(2) },
              { Summary: "Total Budgeted", Amount: totalBudgeted.toFixed(2) },
              {
                Summary: "Remaining Balance",
                Amount: (incomeAmount - totalExpenses).toFixed(2),
              },
            ];
            const summaryWs = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

            // Generate Excel file
            const excelBuffer = XLSX.write(wb, {
              type: "buffer",
              bookType: "xlsx",
            });

            // Set response headers
            res.setHeader(
              "Content-Type",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
              "Content-Disposition",
              `attachment; filename=financial_report_${Date.now()}.xlsx`
            );

            // Send the file
            res.send(excelBuffer);
          } catch (error) {
            console.error("Error generating Excel file:", error);
            res.status(500).json({ error: "Failed to generate Excel file" });
          }
          connection.end();
        });
      });
    });
  } catch (error) {
    connection.end();
    return handleError(res, "Error generating Excel file", error);
  }
});

function formatExcelSheet(worksheet) {
  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  const colWidths = [];
  for (let i = 0; i <= range.e.c; i++) {
    colWidths.push({ wch: 15 });
  }

  if (range.e.c >= 1) colWidths[1].wch = 30; // Description column

  worksheet["!cols"] = colWidths;
}

// Create user_logs table
function logUserActivity(userId, action, details, ip, callback) {
  const connection = createConnection();

  connection.connect((err) => {
    if (err) {
      console.error("Error connecting to database:", err);
      if (callback) callback(err);
      return;
    }

    const query =
      "INSERT INTO user_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)";
    connection.query(query, [userId, action, details, ip], (err, result) => {
      connection.end();
      if (err) {
        console.error("Error logging user activity:", err);
      }
      if (callback) callback(err, result);
    });
  });
}

// ====================================
// USER ACTIVITY LOGS ROUTES
// ====================================

app.get("/api/user-logs", authenticateJWT, (req, res) => {
  const userId = req.user.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = `
      SELECT 
        action, 
        details, 
        ip_address,
        created_at as timestamp
      FROM user_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC
      LIMIT 100
    `;

    connection.query(query, [userId], (err, logs) => {
      if (err) {
        console.error("Error fetching user logs:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to fetch activity logs" });
      }

      res.json(logs);
      connection.end();
    });
  });
});

// ====================================
// USER SETTINGS ROUTES
// ====================================

// Get all settings for a user
app.get("/api/user-settings", authenticateJWT, (req, res) => {
  const userId = req.user.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query =
      "SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?";
    connection.query(query, [userId], (err, results) => {
      if (err) {
        console.error("Error fetching user settings:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to fetch user settings" });
      }

      // Convert to key-value object
      const settings = {};
      results.forEach((row) => {
        settings[row.setting_key] = row.setting_value;
      });

      // Set defaults for missing settings
      const defaults = {
        currency: "KES",
        theme: "light",
        default_view: "summary",
        default_budget_period: "monthly",
        report_format: "pdf",
      };

      // Apply defaults for any missing settings
      Object.keys(defaults).forEach((key) => {
        if (!settings[key]) {
          settings[key] = defaults[key];
        }
      });

      res.json(settings);
      connection.end();
    });
  });
});

// Update a user setting
app.post("/api/user-settings", authenticateJWT, (req, res) => {
  const userId = req.user.userId;
  const { setting_key, setting_value } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!setting_key || setting_value === undefined) {
    return res
      .status(400)
      .json({ message: "Setting key and value are required" });
  }

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = `
      INSERT INTO user_settings (user_id, setting_key, setting_value) 
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE setting_value = ?
    `;

    connection.query(
      query,
      [userId, setting_key, setting_value, setting_value],
      (err, result) => {
        if (err) {
          console.error("Error updating user setting:", err);
          connection.end();
          return res
            .status(500)
            .json({ error: "Failed to update user setting" });
        }

        logUserActivity(
          userId,
          "SETTING_UPDATED",
          `Updated setting: ${setting_key} to ${setting_value}`,
          ip
        );

        res.json({ message: "Setting updated successfully" });
        connection.end();
      }
    );
  });
});

// Update multiple settings at once
app.post("/api/user-settings/batch", authenticateJWT, (req, res) => {
  const userId = req.user.userId;
  const { settings } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!settings || !Object.keys(settings).length) {
    return res.status(400).json({ message: "Settings object is required" });
  }

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    // Prepare batch queries
    const queries = [];
    const values = [];

    Object.keys(settings).forEach((key) => {
      queries.push(`
        INSERT INTO user_settings (user_id, setting_key, setting_value) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
      `);
      values.push(userId, key, settings[key], settings[key]);
    });

    // Use transaction for batch update
    connection.beginTransaction((err) => {
      if (err) {
        connection.end();
        return handleError(res, "Failed to start transaction", err);
      }

      let completed = 0;
      let success = true;

      queries.forEach((query, i) => {
        const params = values.slice(i * 4, (i + 1) * 4);

        connection.query(query, params, (err) => {
          completed++;

          if (err) {
            console.error(`Error updating setting ${values[i * 4 + 1]}:`, err);
            success = false;
          }

          if (completed === queries.length) {
            if (success) {
              connection.commit((err) => {
                if (err) {
                  connection.rollback(() => {
                    connection.end();
                    return handleError(
                      res,
                      "Failed to commit transaction",
                      err
                    );
                  });
                } else {
                  logUserActivity(
                    userId,
                    "SETTINGS_BATCH_UPDATED",
                    `Updated ${Object.keys(settings).length} settings`,
                    ip
                  );

                  res.json({ message: "Settings updated successfully" });
                  connection.end();
                }
              });
            } else {
              connection.rollback(() => {
                connection.end();
                return res
                  .status(500)
                  .json({ error: "Failed to update some settings" });
              });
            }
          }
        });
      });
    });
  });
});

// ====================================
// SAVING GOALS ROUTES & FUNCTIONS
// ====================================

app.post("/api/saving-goals", authenticateJWT, (req, res) => {
  const { name, target_amount, deadline, category } = req.body;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;

  // Validate required fields
  if (!name || !target_amount || !deadline || !category) {
    return res.status(400).json({
      message: "All fields are required",
      required: {
        name: !name,
        target_amount: !target_amount,
        deadline: !deadline,
        category: !category,
      },
    });
  }

  // Validate target amount is positive
  if (parseFloat(target_amount) <= 0) {
    return res.status(400).json({
      message: "Target amount must be greater than 0",
    });
  }

  // Validate deadline is in the future
  const deadlineDate = new Date(deadline);
  if (deadlineDate <= new Date()) {
    return res.status(400).json({
      message: "Deadline must be in the future",
    });
  }

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = `
      INSERT INTO saving_goals (
        user_id, 
        name, 
        target_amount, 
        current_amount, 
        deadline, 
        category, 
        status
      ) VALUES (?, ?, ?, 0, ?, ?, 'active')
    `;

    connection.query(
      query,
      [userId, name, target_amount, deadline, category],
      (err, result) => {
        if (err) {
          console.error("Error creating saving goal:", err);
          connection.end();
          return res.status(500).json({
            error: "Failed to create saving goal",
            details: err.message,
          });
        }

        logUserActivity(
          userId,
          "SAVING_GOAL_CREATED",
          `Created saving goal: ${name} (Target: ${target_amount})`,
          ip
        );

        res.json({
          message: "Saving goal created successfully",
          id: result.insertId,
          goal: {
            id: result.insertId,
            name,
            target_amount,
            current_amount: 0,
            deadline,
            category,
            status: "active",
          },
        });
        connection.end();
      }
    );
  });
});

app.get("/api/saving-goals", authenticateJWT, (req, res) => {
  const userId = req.user.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query =
      "SELECT * FROM saving_goals WHERE user_id = ? ORDER BY created_at DESC";
    connection.query(query, [userId], (err, goals) => {
      if (err) {
        console.error("Error fetching saving goals:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to fetch saving goals" });
      }

      res.json(goals);
      connection.end();
    });
  });
});

app.put("/api/saving-goals/:id", authenticateJWT, (req, res) => {
  const goalId = req.params.id;
  const userId = req.user.userId;
  const { name, target_amount, deadline, category, current_amount, status } =
    req.body;
  const ip = req.ip || req.connection.remoteAddress;

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = `
      UPDATE saving_goals 
      SET name = ?, target_amount = ?, deadline = ?, category = ?, current_amount = ?, status = ?
      WHERE id = ? AND user_id = ?
    `;

    connection.query(
      query,
      [
        name,
        target_amount,
        deadline,
        category,
        current_amount,
        status,
        goalId,
        userId,
      ],
      (err, result) => {
        if (err) {
          console.error("Error updating saving goal:", err);
          connection.end();
          return res
            .status(500)
            .json({ error: "Failed to update saving goal" });
        }

        if (result.affectedRows === 0) {
          connection.end();
          return res.status(404).json({ message: "Saving goal not found" });
        }

        logUserActivity(
          userId,
          "SAVING_GOAL_UPDATED",
          `Updated saving goal: ${name}`,
          ip
        );

        res.json({ message: "Saving goal updated successfully" });
        connection.end();
      }
    );
  });
});

app.delete("/api/saving-goals/:id", authenticateJWT, (req, res) => {
  const goalId = req.params.id;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "DELETE FROM saving_goals WHERE id = ? AND user_id = ?";
    connection.query(query, [goalId, userId], (err, result) => {
      if (err) {
        console.error("Error deleting saving goal:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to delete saving goal" });
      }

      if (result.affectedRows === 0) {
        connection.end();
        return res.status(404).json({ message: "Saving goal not found" });
      }

      logUserActivity(
        userId,
        "SAVING_GOAL_DELETED",
        `Deleted saving goal ID: ${goalId}`,
        ip
      );

      res.json({ message: "Saving goal deleted successfully" });
      connection.end();
    });
  });
});

// ====================================
// REMINDERS ROUTES & FUNCTIONS
// ====================================

app.post("/api/reminders", authenticateJWT, (req, res) => {
  const { title, description, due_date, priority, type } = req.body;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;

  if (!title || !due_date || !priority || !type) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = `
      INSERT INTO reminders (user_id, title, description, due_date, priority, type, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    connection.query(
      query,
      [userId, title, description, due_date, priority, type],
      (err, result) => {
        if (err) {
          console.error("Error creating reminder:", err);
          connection.end();
          return res.status(500).json({ error: "Failed to create reminder" });
        }

        logUserActivity(
          userId,
          "REMINDER_CREATED",
          `Created reminder: ${title}`,
          ip
        );

        res.json({
          message: "Reminder created successfully",
          id: result.insertId,
        });
        connection.end();
      }
    );
  });
});

app.get("/api/reminders", authenticateJWT, (req, res) => {
  const userId = req.user.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query =
      "SELECT * FROM reminders WHERE user_id = ? ORDER BY due_date ASC";
    connection.query(query, [userId], (err, reminders) => {
      if (err) {
        console.error("Error fetching reminders:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to fetch reminders" });
      }

      res.json(reminders);
      connection.end();
    });
  });
});

app.put("/api/reminders/:id", authenticateJWT, (req, res) => {
  const reminderId = req.params.id;
  const userId = req.user.userId;
  const { title, description, due_date, priority, type, status } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = `
      UPDATE reminders 
      SET title = ?, description = ?, due_date = ?, priority = ?, type = ?, status = ?
      WHERE id = ? AND user_id = ?
    `;

    connection.query(
      query,
      [
        title,
        description,
        due_date,
        priority,
        type,
        status,
        reminderId,
        userId,
      ],
      (err, result) => {
        if (err) {
          console.error("Error updating reminder:", err);
          connection.end();
          return res.status(500).json({ error: "Failed to update reminder" });
        }

        if (result.affectedRows === 0) {
          connection.end();
          return res.status(404).json({ message: "Reminder not found" });
        }

        logUserActivity(
          userId,
          "REMINDER_UPDATED",
          `Updated reminder: ${title}`,
          ip
        );

        res.json({ message: "Reminder updated successfully" });
        connection.end();
      }
    );
  });
});

app.delete("/api/reminders/:id", authenticateJWT, (req, res) => {
  const reminderId = req.params.id;
  const userId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;

  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "DELETE FROM reminders WHERE id = ? AND user_id = ?";
    connection.query(query, [reminderId, userId], (err, result) => {
      if (err) {
        console.error("Error deleting reminder:", err);
        connection.end();
        return res.status(500).json({ error: "Failed to delete reminder" });
      }

      if (result.affectedRows === 0) {
        connection.end();
        return res.status(404).json({ message: "Reminder not found" });
      }

      logUserActivity(
        userId,
        "REMINDER_DELETED",
        `Deleted reminder ID: ${reminderId}`,
        ip
      );

      res.json({ message: "Reminder deleted successfully" });
      connection.end();
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
