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

app.get("/home", (req, res) => {
  res.sendFile(__dirname + "/homepage.html");
});

app.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  insertUserData(username, email, password, res);
});

app.post("/signin", (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  authenticateUser(username, password, res, ip);
});

// API routes with authentication
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

    // First, get the user's income
    const incomeQuery = "SELECT amount FROM income WHERE user_id = ?";
    connection.query(incomeQuery, [userId], (err, incomeResults) => {
      if (err) {
        connection.end();
        return handleError(res, "Error checking income", err);
      }

      const income =
        incomeResults.length > 0 ? parseFloat(incomeResults[0].amount) : 0;

      // Then, get the total of current expenses
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

        // Check if adding this expense would exceed income
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

        // Check if there's a budget for this category
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

            // Check if this expense would exceed the category budget
            const budget = parseFloat(budgetResults[0].amount);

            // Get the total of expenses for this category
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

                // Check if adding this expense would exceed the category budget
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

                // Now insert the expense
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

                    // Return a response that includes whether budget is exceeded
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

      // Group expenses by category
      const categoryGroups = {};
      const categoryTotals = {};
      const categoryCounts = {};
      let totalExpenses = 0;

      expenses.forEach((expense) => {
        const category = expense.category;

        // Initialize category arrays and counters if they don't exist
        if (!categoryGroups[category]) {
          categoryGroups[category] = [];
          categoryTotals[category] = 0;
          categoryCounts[category] = 0;
        }

        // Add expense to its category group
        categoryGroups[category].push(expense);

        // Update category totals and counts
        categoryTotals[category] += parseFloat(expense.amount);
        categoryCounts[category]++;

        // Update overall total
        totalExpenses += parseFloat(expense.amount);
      });

      // Format the response with the grouped data
      res.json({
        expenses: expenses, // Original array for backward compatibility
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

      // Check if income exists for user
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

      // Changed query to only select the amount column which definitely exists
      const query = "SELECT amount FROM income WHERE user_id = ?";
      connection.query(query, [userId], (err, results) => {
        if (err) {
          console.error("Error fetching income:", err);
          connection.end();
          return res.status(500).json({ error: "Failed to fetch income" });
        }

        const income = results.length > 0 ? results[0].amount : 0;
        // Use current timestamp instead of column value
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

// Delete an expense
app.delete("/deleteExpense/:id", authenticateJWT, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.user.userId;
    const ip = req.ip || req.connection.remoteAddress;

    // First verify the expense belongs to the user
    const checkQuery = "SELECT * FROM expenses WHERE id = ? AND user_id = ?";
    const connection = createConnection();

    connection.connect((err) => {
      if (err) return handleError(res, "Database connection error", err);

      connection.query(checkQuery, [expenseId, userId], (err, results) => {
        if (err) {
          console.error("Error checking expense ownership:", err);
          connection.end();
          return handleError(res, "Error checking expense ownership", err);
        }

        if (results.length === 0) {
          connection.end();
          return res.status(404).json({ message: "Expense not found" });
        }

        // Delete the expense
        const query = "DELETE FROM expenses WHERE id = ? AND user_id = ?";
        connection.query(query, [expenseId, userId], (err, result) => {
          if (err) {
            console.error("Error deleting expense:", err);
            connection.end();
            return handleError(res, "Error deleting expense", err);
          }

          if (result.affectedRows === 0) {
            connection.end();
            return res.status(404).json({ message: "Expense not found" });
          }

          connection.end();
          logUserActivity(
            userId,
            "EXPENSE_DELETED",
            `Deleted expense - ID: ${expenseId}`,
            ip
          );
          res.json({ message: "Expense deleted successfully" });
        });
      });
    });
  } catch (error) {
    console.error("Error in deleteExpense:", error);
    res.status(500).json({ message: "Internal server error" });
  }
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

// Get dashboard summary for a specific user
app.get("/getDashboardSummary/:userId", authenticateJWT, (req, res) => {
  const userId = req.params.userId;
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    // Get total budgeted amount
    const budgetQuery =
      "SELECT SUM(amount) as totalBudgeted FROM budgets WHERE user_id = ?";
    connection.query(budgetQuery, [userId], (err, budgetResult) => {
      if (err) {
        connection.end();
        return handleError(res, "Error fetching budget total", err);
      }

      const totalBudgeted = budgetResult[0].totalBudgeted || 0;

      // Get total expenses
      const expenseQuery =
        "SELECT SUM(amount) as totalExpenses FROM expenses WHERE user_id = ?";
      connection.query(expenseQuery, [userId], (err, expenseResult) => {
        if (err) {
          connection.end();
          return handleError(res, "Error fetching expense total", err);
        }

        const totalExpenses = expenseResult[0].totalExpenses || 0;

        // Get user's income
        const incomeQuery = "SELECT amount FROM income WHERE user_id = ?";
        connection.query(incomeQuery, [userId], (err, incomeResult) => {
          if (err) {
            connection.end();
            return handleError(res, "Error fetching income", err);
          }

          const income = incomeResult[0]?.amount || 0;
          const remainingBudget = income - totalExpenses;

          res.json({
            income,
            totalBudgeted,
            totalExpenses,
            remainingBudget,
          });

          connection.end();
        });
      });
    });
  });
});

// Add the dashboard summary endpoint
app.get("/api/dashboardSummary/:userId", authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Verify the requesting user matches the userId parameter
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

      // Get total budgeted amount
      const budgetQuery =
        "SELECT SUM(amount) as totalBudgeted FROM budgets WHERE user_id = ?";
      connection.query(budgetQuery, [userId], (err, budgetResult) => {
        if (err) {
          console.error("Error fetching budget total:", err);
          connection.end();
          return handleError(res, "Failed to fetch budget data", res, err);
        }

        const totalBudgeted = budgetResult[0].totalBudgeted || 0;

        // Get total expenses
        const expenseQuery =
          "SELECT SUM(amount) as totalExpenses FROM expenses WHERE user_id = ?";
        connection.query(expenseQuery, [userId], (err, expenseResult) => {
          if (err) {
            console.error("Error fetching expense total:", err);
            connection.end();
            return handleError(res, "Failed to fetch expense data", res, err);
          }

          const totalExpenses = expenseResult[0].totalExpenses || 0;

          // Get user's income
          const incomeQuery = "SELECT amount FROM income WHERE user_id = ?";
          connection.query(incomeQuery, [userId], (err, incomeResult) => {
            if (err) {
              console.error("Error fetching income:", err);
              connection.end();
              return handleError(res, "Failed to fetch income data", res, err);
            }

            const income = incomeResult.length > 0 ? incomeResult[0].amount : 0;
            const remainingBudget = income - totalExpenses;

            // Return the dashboard summary
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

// Verify token endpoint
app.get("/api/verify-token", authenticateJWT, (req, res) => {
  // If we get here, it means the token was valid (authenticateJWT middleware passed)
  const userId = req.user.userId;
  const username = req.user.username;

  // Return user information
  res.json({
    valid: true,
    userId: userId,
    username: username,
  });
});

// Database functions

//1. authenticateUser
function authenticateUser(username, password, res, ip) {
  const connection = createConnection();

  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    const query = "SELECT * FROM users WHERE username = ?";
    connection.query(query, [username], (err, results) => {
      if (err) return handleError(res, "Error querying data", err);

      if (results.length === 0) {
        logUserActivity(
          null,
          "LOGIN_FAILED",
          `Failed login attempt for username: ${username}`,
          ip
        );
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      const user = results[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return handleError(res, "Error comparing passwords", err);

        if (!isMatch) {
          logUserActivity(user.id, "LOGIN_FAILED", "Invalid password", ip);
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

          logUserActivity(
            user.id,
            "LOGIN_SUCCESS",
            "User logged in successfully",
            ip
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
function insertBudgetData(userId, frequency, category, amount, res, ip) {
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
        logUserActivity(
          userId,
          "BUDGET_ERROR",
          `Attempted to add budget (${category}: Ksh ${budgetAmount}) exceeding income (Ksh ${monthlyIncome})`,
          ip
        );
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

        // If no existing budget found, insert the new one
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
              `Added new budget - Category: ${category}, Amount: Ksh ${amount}, Frequency: ${frequency}`,
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

//4. Expense routes
function insertExpenseData(
  userId,
  date,
  description,
  category,
  amount,
  res,
  ip
) {
  if (!date || !description || !category || !amount || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid expense data" });
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
            if (err) return handleError(res, "Error inserting data", err);

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
function deleteExpenseData(expenseId, userId, res, ip) {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) return handleError(res, "Database connection error", err);

    // First verify the expense belongs to the user
    const checkQuery = "SELECT * FROM expenses WHERE id = ? AND user_id = ?";
    connection.query(checkQuery, [expenseId, userId], (err, results) => {
      if (err) return handleError(res, "Error checking expense ownership", err);

      if (results.length === 0) {
        connection.end();
        return res.status(404).json({ message: "Expense not found" });
      }

      // Delete the expense
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

// Function to delete budget data
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
    `CREATE TABLE IF NOT EXISTS budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      frequency VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS income (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
  ];

  tables.forEach((tableQuery) => {
    connection.query(tableQuery, (err) => {
      if (err) console.error("Error creating table:", err);
    });
  });

  // Add a migration to check for and add the modified_at column if it doesn't exist
  migrateIncomeTable();

  connection.end();
});

// Function to add modified_at column to income table if it doesn't exist
function migrateIncomeTable() {
  const connection = createConnection();
  connection.connect((err) => {
    if (err) {
      console.error("Error connecting to database for migration:", err);
      return;
    }

    // First check if the column exists
    const checkColumnQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'income' AND COLUMN_NAME = 'modified_at'
    `;

    connection.query(
      checkColumnQuery,
      [process.env.DB_NAME],
      (err, results) => {
        if (err) {
          console.error("Error checking for column existence:", err);
          connection.end();
          return;
        }

        // If column doesn't exist, add it
        if (results.length === 0) {
          console.log("Adding missing modified_at column to income table...");
          const addColumnQuery = `
          ALTER TABLE income 
          ADD COLUMN modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `;

          connection.query(addColumnQuery, (err) => {
            if (err) {
              console.error("Error adding modified_at column:", err);
            } else {
              console.log(
                "Successfully added modified_at column to income table"
              );
            }
            connection.end();
          });
        } else {
          console.log("modified_at column already exists in income table");
          connection.end();
        }
      }
    );
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
