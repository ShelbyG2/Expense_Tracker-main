// Check if Chart.js is loaded
if (typeof Chart === "undefined") {
  console.error("Chart.js is not loaded! Charts will not render.");
} else {
  console.log("Chart.js is loaded successfully:", Chart.version);
}

// Global variables to store expenses and budgets
let expenses = [];
let budgets = [];
let income = 0;

// DOM elements
const budgetForm = document.getElementById("budgetForm");
const expenseList = document.getElementById("expenseList");
const budgetList = document.getElementById("budgetList");
const totalExpensesElement = document.getElementById("totalExpenses");
const totalBudgetedElement = document.getElementById("totalBudgeted");
const remainingBudgetElement = document.getElementById("remainingBudget");
const incomeInput = document.getElementById("income");
const sections = document.querySelectorAll(".section");
const navItems = document.querySelectorAll(".sidebar-nav li");
const modals = document.querySelectorAll(".modal");
const closeButtons = document.querySelectorAll(".close");
const incomeDisplay = document.getElementById("income-display");
const username = document.getElementById("username");

// Chart variables
let expensePieChart = null;
let budgetVsExpenseChart = null;
let monthlyTrendChart = null;
let categoryComparisonChart = null;

// Define a consistent color palette for the application
const chartColors = {
  // Primary colors for main data
  primary: {
    budget: {
      background: "rgba(52, 152, 219, 0.6)", // Soft blue
      border: "rgba(52, 152, 219, 1)",
    },
    expense: {
      background: "rgba(231, 76, 60, 0.6)", // Soft red
      border: "rgba(231, 76, 60, 1)",
    },
  },
  // Category colors for pie charts
  categories: [
    { background: "rgba(52, 152, 219, 0.8)", border: "rgba(52, 152, 219, 1)" }, // Blue
    { background: "rgba(46, 204, 113, 0.8)", border: "rgba(46, 204, 113, 1)" }, // Green
    { background: "rgba(155, 89, 182, 0.8)", border: "rgba(155, 89, 182, 1)" }, // Purple
    { background: "rgba(241, 196, 15, 0.8)", border: "rgba(241, 196, 15, 1)" }, // Yellow
    { background: "rgba(230, 126, 34, 0.8)", border: "rgba(230, 126, 34, 1)" }, // Orange
    { background: "rgba(52, 73, 94, 0.8)", border: "rgba(52, 73, 94, 1)" }, // Dark Blue
    { background: "rgba(231, 76, 60, 0.8)", border: "rgba(231, 76, 60, 1)" }, // Red
    { background: "rgba(26, 188, 156, 0.8)", border: "rgba(26, 188, 156, 1)" }, // Turquoise
  ],
  // Trend line colors
  trend: {
    line: "rgba(52, 152, 219, 1)", // Blue
    background: "rgba(52, 152, 219, 0.2)",
  },
  // Utilization line color
  utilization: {
    line: "rgba(155, 89, 182, 1)", // Purple
  },
};

// DOM Elements Cache
const elements = {
  totalIncome: document.getElementById("totalIncome"),
  totalExpenses: document.getElementById("totalExpenses"),
  totalBudgeted: document.getElementById("totalBudgeted"),
  remainingBudget: document.getElementById("remainingBudget"),
  budgetList: document.getElementById("budgetList"),
  expenseList: document.getElementById("expenseList"),
  username: document.getElementById("username"),
};

// Authentication and User Management
function checkAuthentication() {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  if (!token || !userId) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function addAuthHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  };
}

// Data Loading Functions
async function loadInitialData() {
  if (!checkAuthentication()) return;

  const userId = localStorage.getItem("userId");
  try {
    await Promise.all([
      loadIncome(userId),
      loadExpenses(userId),
      loadBudgets(userId),
      updateCharts(userId),
    ]);
  } catch (error) {
    console.error("Error loading initial data:", error);
    showNotification("Failed to load data", "error");
  }
}

async function loadIncome(userId) {
  try {
    console.log("Loading income for user:", userId);
    const response = await fetch(`/api/income`, {
      headers: addAuthHeader(),
    });

    if (!response.ok) {
      console.error("Income API error status:", response.status);
      throw new Error("Failed to fetch income");
    }

    const data = await response.json();
    console.log("Income data received:", data);

    // Update income display
    const incomeElement = document.getElementById("totalIncome");
    if (incomeElement) {
      incomeElement.textContent = formatCurrency(data.income || 0);
    } else {
      console.warn("Income display element not found");
    }

    return data.income;
  } catch (error) {
    console.error("Error loading income:", error);
    showNotification("Failed to load income", "error");
    return 0;
  }
}

// Chart Update Functions
async function updateCharts(userId) {
  try {
    if (!userId) {
      console.error("No userId provided for chart updates");
      return;
    }

    console.log("==== CHART DEBUG ====");
    console.log("Updating charts for user:", userId);

    // Get current expense and budget data
    const [expenseData, budgetData] = await Promise.all([
      getExpenseData(userId),
      getBudgetData(userId),
    ]);

    console.log("Chart data retrieved:", {
      expenseLabels: expenseData.labels,
      expenseCount: expenseData.labels.length,
      expenseValues: expenseData.values,
      budgetLabels: budgetData.labels,
      budgetCount: budgetData.labels.length,
      budgetValues: budgetData.values,
    });

    // Update expense pie chart
    const expensePieCtx = document.getElementById("expensePieChart");
    console.log("Expense pie chart element found:", !!expensePieCtx);
    if (expensePieCtx) {
      console.log("Canvas dimensions:", {
        width: expensePieCtx.width,
        height: expensePieCtx.height,
        offsetWidth: expensePieCtx.offsetWidth,
        offsetHeight: expensePieCtx.offsetHeight,
        style: expensePieCtx.style.cssText,
      });

      // Check if chart already exists and destroy it to prevent duplicates
      console.log(
        "Previous expense pie chart exists:",
        !!window.expensePieChart
      );
      if (
        window.expensePieChart &&
        typeof window.expensePieChart.destroy === "function"
      ) {
        window.expensePieChart.destroy();
      } else {
        // Reset the reference if it's invalid
        window.expensePieChart = null;
      }

      // Check if we have data to display
      if (expenseData.labels.length === 0) {
        console.log("No expense data to display in pie chart");
        const ctx = expensePieCtx.getContext("2d");
        ctx.clearRect(0, 0, expensePieCtx.width, expensePieCtx.height);
        ctx.font = "16px Arial";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText(
          "No expense data available",
          expensePieCtx.width / 2,
          expensePieCtx.height / 2
        );
        return;
      }

      try {
        // Create new chart
        console.log("Creating new expense pie chart");
        window.expensePieChart = new Chart(expensePieCtx, {
          type: "pie",
          data: {
            labels: expenseData.labels,
            datasets: [
              {
                label: "Expenses by Category",
                data: expenseData.values,
                backgroundColor: chartColors.categories.map(
                  (color) => color.background
                ),
                borderColor: chartColors.categories.map(
                  (color) => color.border
                ),
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "right",
              },
              title: {
                display: true,
                text: "Expenses by Category",
              },
            },
          },
        });
        console.log("Expense pie chart created successfully");
      } catch (chartError) {
        console.error("Error creating expense pie chart:", chartError);
      }
    } else {
      console.warn("Expense pie chart canvas not found");
    }

    // Update budget vs expense bar chart
    const budgetExpenseCtx = document.getElementById("budgetVsExpenseChart");
    console.log("Budget vs expense chart element found:", !!budgetExpenseCtx);

    if (budgetExpenseCtx) {
      // Check if chart already exists and destroy it
      console.log(
        "Previous budget vs expense chart exists:",
        !!window.budgetExpenseChart
      );
      if (
        window.budgetExpenseChart &&
        typeof window.budgetExpenseChart.destroy === "function"
      ) {
        window.budgetExpenseChart.destroy();
      } else {
        // Reset the reference if it's invalid
        window.budgetExpenseChart = null;
      }

      // Check if we have data to display
      if (budgetData.labels.length === 0 && expenseData.labels.length === 0) {
        console.log("No budget or expense data to display in bar chart");
        const ctx = budgetExpenseCtx.getContext("2d");
        ctx.clearRect(0, 0, budgetExpenseCtx.width, budgetExpenseCtx.height);
        ctx.font = "16px Arial";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText(
          "No budget or expense data available",
          budgetExpenseCtx.width / 2,
          budgetExpenseCtx.height / 2
        );
        return;
      }

      try {
        // Combine data for comparison
        const categories = [
          ...new Set([...budgetData.labels, ...expenseData.labels]),
        ];
        const budgetValues = [];
        const expenseValues = [];

        // Fill arrays with corresponding values or 0
        categories.forEach((category) => {
          const budgetIndex = budgetData.labels.indexOf(category);
          const expenseIndex = expenseData.labels.indexOf(category);

          budgetValues.push(
            budgetIndex !== -1 ? budgetData.values[budgetIndex] : 0
          );
          expenseValues.push(
            expenseIndex !== -1 ? expenseData.values[expenseIndex] : 0
          );
        });

        // Create new chart
        console.log("Creating new budget vs expense chart");
        window.budgetExpenseChart = new Chart(budgetExpenseCtx, {
          type: "bar",
          data: {
            labels: categories,
            datasets: [
              {
                label: "Budget",
                data: budgetValues,
                backgroundColor: chartColors.primary.budget.background,
                borderColor: chartColors.primary.budget.border,
                borderWidth: 2,
              },
              {
                label: "Expense",
                data: expenseValues,
                backgroundColor: chartColors.primary.expense.background,
                borderColor: chartColors.primary.expense.border,
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "top",
              },
              title: {
                display: true,
                text: "Budget vs Expense by Category",
              },
            },
            scales: {
              y: {
                beginAtZero: true,
              },
            },
          },
        });
        console.log("Budget vs expense chart created successfully");
      } catch (chartError) {
        console.error("Error creating budget vs expense chart:", chartError);
      }
    } else {
      console.warn("Budget vs expense chart canvas not found");
    }

    // Update analytics charts if that section is active
    const analyticsSection = document.getElementById("charts");
    console.log("Analytics section found:", !!analyticsSection);
    if (analyticsSection && analyticsSection.classList.contains("active")) {
      console.log("Updating analytics charts");
      updateAnalyticsCharts(userId);
    }
    console.log("==== END CHART DEBUG ====");
  } catch (error) {
    console.error("Error updating charts:", error);
  }
}

// Event Handlers
function setupEventListeners() {
  document.querySelectorAll(".sidebar-nav li").forEach((item) => {
    item.addEventListener("click", () => switchSection(item.dataset.section));
  });

  setupModalEventListeners();
  setupFormEventListeners();
}

// Modal Management
function setupModalEventListeners() {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    const closeBtn = modal.querySelector(".close");
    closeBtn.addEventListener("click", () => closeModal(modal));
  });
}

// Form Handling
function setupFormEventListeners() {
  const budgetForm = document.getElementById("budgetForm");
  budgetForm?.addEventListener("submit", handleBudgetSubmit);
}

// Utility Functions
function formatCurrency(amount) {
  return `KES ${parseFloat(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function showNotification(message, type = "success") {
  // Implementation of notification system
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Page loaded, checking authentication...");

  // Initialize form elements
  const budgetForm = document.getElementById("budgetForm");
  // We'll get expenseForm inside setupFormHandlers to avoid redeclaration issues

  if (await checkAuthentication()) {
    console.log("User is authenticated, loading data...");
    await loadInitialData();

    // Set username
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      username.textContent = storedUsername;
      console.log("Username set to:", storedUsername);
    }

    // Setup navigation
    setupNavigation();

    // Setup modals
    setupModals();

    // Setup form handlers
    setupFormHandlers();
  }

  // Add these event listeners to update dashboard
  document.addEventListener("budgetUpdated", updateDashboard);
  document.addEventListener("expenseAdded", updateDashboard);
  document.addEventListener("expenseDeleted", updateDashboard);
  document.addEventListener("incomeUpdated", updateDashboard);

  // NOTE: The style categories code has been moved to the main DOMContentLoaded handler
  // to avoid duplicate event handlers and code

  // Add these helper functions to organize the setup code

  // Add consistent event listeners for all data change events to update dashboard
  const dataChangeEvents = [
    "budgetAdded",
    "budgetUpdated",
    "budgetDeleted",
    "expenseAdded",
    "expenseUpdated",
    "expenseDeleted",
  ];

  dataChangeEvents.forEach((eventName) => {
    document.removeEventListener(eventName, updateDashboard); // Remove any existing to prevent duplicates
    document.addEventListener(eventName, () => {
      console.log(`Event triggered: ${eventName}`);
      const userId = localStorage.getItem("userId");
      if (userId) {
        updateDashboard(userId);
      }
    });
  });

  // Connect the budget form submission
  if (budgetForm) {
    budgetForm.addEventListener("submit", submitBudgetForm);
    console.log("Budget form submission handler attached");
  } else {
    console.warn("Budget form not found - will be connected when available");
  }

  // Connect the expense form submission
  const expenseForm = document.getElementById("expenseForm");
  if (expenseForm) {
    expenseForm.addEventListener("submit", handleExpenseSubmit);
    console.log("Expense form submission handler attached");
  } else {
    console.warn("Expense form not found - will be connected when available");
  }

  // Handle tab switching between dashboard, expenses, budgets, and analytics
  const tabs = document.querySelectorAll(".tab-link");
  const contentSections = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", function (e) {
      e.preventDefault();

      // Get the target section ID
      const targetId = this.getAttribute("data-target");
      console.log(`Switching to tab: ${targetId}`);

      // Remove active class from all tabs and content sections
      tabs.forEach((t) => t.classList.remove("active"));
      contentSections.forEach((section) => section.classList.remove("active"));

      // Add active class to current tab and target content
      this.classList.add("active");
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add("active");

        // If switching to dashboard or analytics, update charts
        const userId = localStorage.getItem("userId");
        if (userId && (targetId === "dashboard" || targetId === "charts")) {
          console.log(`Refreshing charts for ${targetId}`);
          if (targetId === "dashboard") {
            updateDashboard(userId);
          } else if (targetId === "charts") {
            updateAnalyticsCharts(userId);
          }
        }
      }
    });
  });

  // Initialize dashboard if user is logged in
  const userId = localStorage.getItem("userId");
  if (userId) {
    console.log("User is logged in, initializing dashboard");
    // Set user name if available
    const userName = localStorage.getItem("userName");
    if (userName) {
      const userNameElement = document.getElementById("userName");
      if (userNameElement) {
        userNameElement.textContent = userName;
      }
    }

    // Initialize dashboard
    updateDashboard(userId);

    // Load data for other sections
    loadExpenses();
    loadBudgets();

    // Show logged in UI elements
    document.querySelectorAll(".logged-in-only").forEach((el) => {
      el.style.display = "block";
    });
    document.querySelectorAll(".logged-out-only").forEach((el) => {
      el.style.display = "none";
    });
  } else {
    console.log("No user logged in");
    // Show logged out UI elements
    document.querySelectorAll(".logged-in-only").forEach((el) => {
      el.style.display = "none";
    });
    document.querySelectorAll(".logged-out-only").forEach((el) => {
      el.style.display = "block";
    });
  }
});

// Function to check authentication
async function checkAuthentication() {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  console.log("Checking authentication:", {
    hasToken: !!token,
    hasUserId: !!userId,
  });

  if (!token || !userId) {
    console.log("No authentication credentials found");
    showNotification("Please log in to access your data", "error");
    window.location.href = "login.html";
    return false;
  }

  try {
    // Verify token is valid
    const response = await fetch("/api/verify-token", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.log("Token verification failed:", response.status);
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("username");
      showNotification(
        "Your session has expired. Please log in again.",
        "error"
      );
      window.location.href = "login.html";
      return false;
    }

    const data = await response.json();
    console.log("Token verification successful:", data);

    // Update stored user information if needed
    if (data.username && data.username !== localStorage.getItem("username")) {
      localStorage.setItem("username", data.username);
    }

    return true;
  } catch (error) {
    console.error("Error verifying authentication:", error);
    showNotification(
      "Error verifying your session. Please try again.",
      "error"
    );
    return false;
  }
}

// Function to add authentication header
function addAuthHeader(headers = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("No auth token found when trying to make request");
  }

  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  console.log("Request headers:", authHeaders);
  return authHeaders;
}

// Function to show notifications
function showNotification(message, type = "success") {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll(".notification");
  existingNotifications.forEach((notification) => notification.remove());

  // Create new notification
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas ${
      type === "success" ? "fa-check-circle" : "fa-exclamation-circle"
    }"></i>
    ${message}
  `;
  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add event listeners
document.getElementById("addExpenseBtn").addEventListener("click", () => {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    showNotification("Please log in to add an expense", "error");
    return;
  }
  // Show the expense modal instead of directly submitting
  showExpenseModal();
});

document.getElementById("income").addEventListener("change", () => {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    showNotification("Please log in to update income", "error");
    return;
  }
  updateIncome(userId);
});

// Function to load expenses
async function loadExpenses() {
  try {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      showNotification("Please log in to view expenses", "error");
      return;
    }

    const response = await fetch(`/api/expenses/${userId}`, {
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch expenses");
    }

    const data = await response.json();
    console.log("Expenses loaded:", data);

    const expenseList = document.getElementById("expenseList");
    expenseList.innerHTML = "";

    if (!data.expenses || data.expenses.length === 0) {
      expenseList.innerHTML = '<li class="list-item">No expenses found</li>';
      return;
    }

    // Create container for grouped expenses
    const categoriesContainer = document.createElement("div");
    categoriesContainer.className = "categories-container";

    // Loop through each category
    Object.keys(data.categoryGroups).forEach((category) => {
      const expenses = data.categoryGroups[category];
      const total = data.categoryTotals[category];
      const count = data.categoryCounts[category];

      // Create category section
      const categorySection = document.createElement("div");
      categorySection.className = "category-section";

      // Create category header
      const categoryHeader = document.createElement("div");
      categoryHeader.className = "category-header";
      categoryHeader.innerHTML = `
        <div class="category-name">${category}</div>
        <div class="category-summary">
          <span class="category-count">${count} expense${
        count !== 1 ? "s" : ""
      }</span>
          <span class="category-total">Total: KES ${parseFloat(
            total
          ).toLocaleString()}</span>
        </div>
      `;

      // Create expenses container
      const expensesContainer = document.createElement("div");
      expensesContainer.className = "category-expenses";

      // Add individual expenses
      expenses.forEach((expense) => {
        const expenseItem = document.createElement("div");
        expenseItem.className = "expense-item";
        const formattedDate = new Date(expense.date).toLocaleDateString();

        expenseItem.innerHTML = `
          <div class="expense-details">
            <div class="expense-date">${formattedDate}</div>
            <div class="expense-description">${expense.description}</div>
            <div class="expense-amount">KES ${parseFloat(
              expense.amount
            ).toLocaleString()}</div>
        </div>
        <button class="delete-btn" onclick="deleteExpense(${expense.id})">
          <i class="fas fa-trash"></i>
        </button>
      `;

        expensesContainer.appendChild(expenseItem);
      });

      // Assemble the category section
      categorySection.appendChild(categoryHeader);
      categorySection.appendChild(expensesContainer);
      categoriesContainer.appendChild(categorySection);
    });

    expenseList.appendChild(categoriesContainer);

    // Update total expenses
    const totalExpenses = data.totalExpenses || 0;
    document.getElementById(
      "totalExpenses"
    ).textContent = `KES ${totalExpenses.toLocaleString()}`;

    // Trigger chart update - maintain consistent event naming
    const event = new Event("expenseUpdated");
    document.dispatchEvent(event);

    // Also explicitly dispatch expenseAdded event to ensure all listeners trigger
    const addedEvent = new Event("expenseAdded");
    document.dispatchEvent(addedEvent);

    // Add CSS for the new expense display
    if (!document.getElementById("category-style")) {
      const style = document.createElement("style");
      style.id = "category-style";
      style.textContent = `
        .categories-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 10px;
        }
        
        .category-section {
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .category-header {
          background-color: #f5f5f5;
          padding: 12px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #ddd;
        }
        
        .category-name {
          font-weight: bold;
          font-size: 16px;
          color: #333;
        }
        
        .category-summary {
          display: flex;
          gap: 15px;
          font-size: 14px;
          color: #666;
        }
        
        .category-total {
          font-weight: bold;
        }
        
        .category-expenses {
          padding: 0;
        }
        
        .expense-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 15px;
          border-bottom: 1px solid #eee;
        }
        
        .expense-item:last-child {
          border-bottom: none;
        }
        
        .expense-details {
          display: flex;
          align-items: center;
          gap: 15px;
          flex: 1;
        }
        
        .expense-date {
          min-width: 100px;
          color: #666;
        }
        
        .expense-description {
          flex: 1;
        }
        
        .expense-amount {
          font-weight: bold;
          min-width: 120px;
          text-align: right;
        }
        
        .delete-btn {
          background: none;
          border: none;
          color: #e74c3c;
          cursor: pointer;
          font-size: 16px;
          padding: 5px;
          margin-left: 10px;
          transition: color 0.2s;
        }
        
        .delete-btn:hover {
          color: #c0392b;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error("Error loading expenses:", error);
    showNotification(error.message || "Failed to load expenses", "error");
  }
}

// Function to update expense summary
function updateExpenseSummary(expenses) {
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + parseFloat(expense.amount),
    0
  );
  const totalExpensesElement = document.getElementById("totalExpenses");
  totalExpensesElement.textContent = `Ksh ${totalExpenses.toFixed(2)}`;

  // Update remaining budget
  const income = parseFloat(document.getElementById("income").value) || 0;
  const remaining = income - totalExpenses;
  const remainingBudgetElement = document.getElementById("remainingBudget");
  remainingBudgetElement.textContent = `Ksh ${remaining.toFixed(2)}`;
  remainingBudgetElement.className = `amount ${
    remaining >= 0 ? "positive" : "negative"
  }`;
}

// Function to delete an expense
async function deleteExpense(expenseId) {
  if (!confirm("Are you sure you want to delete this expense?")) {
    return;
  }

  try {
    const response = await fetch(`/api/expenses/${expenseId}`, {
      method: "DELETE",
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to delete expense");
    }

    const data = await response.json();
    showNotification(data.message || "Expense deleted successfully", "success");

    // Reload expenses and update UI
    await loadExpenses();
    updateCharts(localStorage.getItem("userId"));
  } catch (error) {
    console.error("Error:", error);
    showNotification(error.message || "Failed to delete expense", "error");
  }
}

// Function to add a new budget
async function addBudget(userId) {
  const frequency = document.getElementById("budgetFrequency").value;
  const category = document.getElementById("budgetCategory").value;
  const amount = document.getElementById("budgetAmount").value;

  if (!frequency || !category || !amount) {
    showNotification("Please fill in all required fields", "error");
    return;
  }

  try {
    const response = await fetch("/api/budgets", {
      method: "POST",
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        userId,
        frequency,
        category,
        amount: parseFloat(amount),
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showNotification(data.message || "Budget added successfully", "success");
      // Reload budgets and update UI
      await loadBudgets();
      await updateDashboardSummary();
      await updateCharts(userId);
    } else {
      showNotification(data.message || "Failed to add budget", "error");
      // If the error is about exceeding income, highlight the amount field
      if (
        data.message &&
        data.message.includes("cannot exceed your monthly income")
      ) {
        const amountInput = document.getElementById("budgetAmount");
        amountInput.classList.add("error");
        setTimeout(() => {
          amountInput.classList.remove("error");
        }, 3000);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to add budget", "error");
  }
}

// Function to update income
async function updateIncome(userId) {
  const amount = parseFloat(incomeInput.value) || 0;

  try {
    const response = await fetch("/api/income", {
      method: "POST",
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ amount }),
    });

    if (response.ok) {
      showNotification("Income updated successfully", "success");
      income = amount; // Update the global income variable
      updateSummary(userId);
    } else {
      const data = await response.json();
      showNotification(data.message || "Failed to update income", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to update income", "error");
  }
}

// Function to display budgets
function displayBudgets(userId) {
  budgetList.innerHTML = "";

  budgets
    .filter((budget) => budget.userId === userId)
    .forEach((budget, index) => {
      const li = document.createElement("li");
      li.className = "list-group-item";

      // Calculate expenses for this category
      const categoryExpenses = expenses
        .filter((e) => e.category === budget.category && e.userId === userId)
        .reduce((sum, e) => sum + e.amount, 0);

      const remaining = budget.amount - categoryExpenses;
      const percentUsed =
        budget.amount > 0 ? (categoryExpenses / budget.amount) * 100 : 0;

      li.innerHTML = `
              <div>
                  <strong>${
                    budget.category
                  }</strong> - Ksh ${budget.amount.toFixed(2)}
                  <div><small>${
                    budget.frequency
                  } | Spent: Ksh ${categoryExpenses.toFixed(
        2
      )} | Remaining: Ksh ${remaining.toFixed(2)}</small></div>
                  <div><small>Used: ${percentUsed.toFixed(1)}%</small></div>
              </div>
              <button class="delete-btn" onclick="deleteBudget(${budget.id})">
                  <i class="fas fa-trash"></i>
              </button>
          `;
      budgetList.appendChild(li);
    });
}

// Function to delete a budget
async function deleteBudget(budgetId) {
  if (!confirm("Are you sure you want to delete this budget?")) {
    return;
  }

  try {
    const response = await fetch(`/api/budgets/${budgetId}`, {
      method: "DELETE",
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to delete budget");
    }

    const data = await response.json();
    showNotification(data.message || "Budget deleted successfully", "success");

    // Reload budgets and update UI
    await loadBudgets();
    updateCharts(localStorage.getItem("userId"));
  } catch (error) {
    console.error("Error:", error);
    showNotification(error.message || "Failed to delete budget", "error");
  }
}

// Function to update summary
function updateSummary(userId) {
  const totalExpenses = expenses
    .filter((expense) => expense.userId === userId)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const totalBudgeted = budgets
    .filter((budget) => budget.userId === userId)
    .reduce((sum, budget) => sum + budget.amount, 0);
  const remainingBudget = income - totalExpenses;

  totalExpensesElement.textContent = totalExpenses.toFixed(2);
  totalBudgetedElement.textContent = totalBudgeted.toFixed(2);
  remainingBudgetElement.textContent = remainingBudget.toFixed(2);

  // Change color based on remaining budget
  if (remainingBudget < 0) {
    remainingBudgetElement.style.color = "red";
  } else {
    remainingBudgetElement.style.color = "green";
  }
}

// Get formatted budget data
async function getBudgetData(userId) {
  try {
    const response = await fetch(`/api/budgets/${userId}`, {
      headers: addAuthHeader({}),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch budget data");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error("Invalid budget data format:", data);
      return null;
    }

    return {
      labels: data.map((item) => item.category),
      values: data.map((item) => parseFloat(item.amount)),
    };
  } catch (error) {
    console.error("Error fetching budget data:", error);
    return null;
  }
}

// Get formatted expense data
async function getExpenseData(userId) {
  try {
    const response = await fetch(`/api/expenses/${userId}`, {
      headers: addAuthHeader({}),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch expense data");
    }

    const responseData = await response.json();

    // The API might return either an array directly or an object with an 'expenses' property
    const data = Array.isArray(responseData)
      ? responseData
      : responseData.expenses || [];

    console.log("Expense data format:", { responseData, data });

    if (!Array.isArray(data)) {
      console.error("Invalid expense data format:", data);
      return { labels: [], values: [] };
    }

    // Group expenses by category
    const groupedExpenses = data.reduce((acc, curr) => {
      const category = curr.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += parseFloat(curr.amount) || 0;
      return acc;
    }, {});

    return {
      labels: Object.keys(groupedExpenses),
      values: Object.values(groupedExpenses),
    };
  } catch (error) {
    console.error("Error fetching expense data:", error);
    return { labels: [], values: [] }; // Return empty arrays instead of null
  }
}

// Update charts when data changes
async function onDataChange() {
  const userId = localStorage.getItem("userId");
  if (userId) {
    await updateCharts(userId);
  }
}

// Add chart update triggers
document.addEventListener("budgetAdded", onDataChange);
document.addEventListener("expenseAdded", onDataChange);
document.addEventListener("budgetDeleted", onDataChange);
document.addEventListener("expenseDeleted", onDataChange);

// Function to load budgets
async function loadBudgets() {
  try {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      console.error("No userId found in localStorage");
      showNotification("Please log in to view budgets", "error");
      return;
    }

    console.log("Fetching budgets for user:", userId);
    const response = await fetch(`/api/budgets/${userId}`, {
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to fetch budgets: ${response.status} ${response.statusText}`,
        errorText
      );
      throw new Error(
        `Failed to fetch budgets: ${response.status} ${response.statusText}`
      );
    }

    const budgets = await response.json();
    console.log("Budgets loaded:", budgets);
    const budgetList = document.getElementById("budgetList");
    budgetList.innerHTML = "";

    if (!Array.isArray(budgets) || budgets.length === 0) {
      console.log("No budgets found for user");
      budgetList.innerHTML = '<li class="list-item">No budgets found</li>';
      return;
    }

    budgets.forEach((budget) => {
      const li = document.createElement("li");
      li.className = "list-item";

      li.innerHTML = `
        <div class="item-content">
          <span class="item-category">${budget.category}</span>
          <span class="item-amount">KES ${parseFloat(
            budget.amount
          ).toLocaleString()}</span>
          <span class="item-frequency">${budget.frequency}</span>
        </div>
        <button class="delete-btn" onclick="deleteBudget(${budget.id})">
          <i class="fas fa-trash"></i>
        </button>
      `;
      budgetList.appendChild(li);
    });

    // Update budget summary
    const totalBudgeted = budgets.reduce(
      (sum, budget) => sum + parseFloat(budget.amount),
      0
    );
    document.getElementById(
      "totalBudgeted"
    ).textContent = `KES ${totalBudgeted.toLocaleString()}`;

    // Trigger chart update with consistent event naming
    const event = new Event("budgetUpdated");
    document.dispatchEvent(event);

    // Also explicitly dispatch budgetAdded event to ensure all listeners trigger
    const addedEvent = new Event("budgetAdded");
    document.dispatchEvent(addedEvent);
  } catch (error) {
    console.error("Error loading budgets:", error);
    showNotification("Failed to load budgets", "error");
  }
}

// Update the loadInitialData function
async function loadInitialData() {
  console.log("Loading initial data...");

  if (!(await checkAuthentication())) {
    return;
  }

  const userId = localStorage.getItem("userId");
  console.log("Loading data for user:", userId);

  try {
    // Show loading state
    document.body.classList.add("loading");

    // Load all data concurrently
    const results = await Promise.all([
      loadIncome().catch((error) => {
        console.error("Error loading income:", error);
        return null;
      }),
      loadBudgets().catch((error) => {
        console.error("Error loading budgets:", error);
        return null;
      }),
      loadExpenses().catch((error) => {
        console.error("Error loading expenses:", error);
        return null;
      }),
    ]);

    console.log("Data loading results:", {
      income: results[0] !== null,
      budgets: results[1] !== null,
      expenses: results[2] !== null,
    });

    // Update dashboard summary
    await updateDashboardSummary();

    // Update charts
    await updateCharts(userId);

    // Hide loading state
    document.body.classList.remove("loading");
  } catch (error) {
    console.error("Error loading initial data:", error);
    showNotification(
      "Failed to load data. Please try refreshing the page.",
      "error"
    );
    document.body.classList.remove("loading");
  }
}

// Update the event listeners for data changes
document.addEventListener("budgetUpdated", async () => {
  const userId = localStorage.getItem("userId");
  if (userId) {
    await updateDashboardSummary();
    await updateCharts(userId);
  }
});

document.addEventListener("expenseUpdated", async () => {
  const userId = localStorage.getItem("userId");
  if (userId) {
    await updateDashboardSummary();
    await updateCharts(userId);
  }
});

// Update the section switching function
function switchSection(sectionId) {
  // Get all sections
  const sections = document.querySelectorAll(".dashboard-sections > section");

  // Hide all sections
  sections.forEach((section) => {
    section.classList.remove("active");
    section.style.display = "none";
  });

  // Show the target section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active");
    targetSection.style.display = "block";
  }

  // Update navigation
  const navItems = document.querySelectorAll(".sidebar-nav ul li");
  navItems.forEach((item) => {
    if (item.getAttribute("data-section") === sectionId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // If switching to summary/dashboard or charts, update the relevant charts
  if (sectionId === "summary") {
    const userId = localStorage.getItem("userId");
    if (userId) {
      updateCharts(userId);
    }
  } else if (sectionId === "charts") {
    const userId = localStorage.getItem("userId");
    if (userId) {
      updateAnalyticsCharts(userId);
    }
  }
}

// Modal functions
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = "block";
}

function closeModal(modal) {
  modal.style.display = "none";
}

function showIncomeModal() {
  showModal("incomeModal");
}

function showBudgetModal() {
  showModal("budgetModal");
}

function showExpenseModal() {
  showModal("expenseModal");
  // Load budgeted categories when the expense modal is opened
  loadBudgetedCategories();
}

// Set up form handlers
function setupFormHandlers() {
  // Budget form handler
  const budgetForm = document.getElementById("budgetForm");
  if (budgetForm) {
    budgetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const userId = localStorage.getItem("userId");
      if (!userId) {
        showNotification("Please log in to add a budget", "error");
        return;
      }
      await addBudget(userId);
      closeModal(document.getElementById("budgetModal"));
    });
  }

  // Income form handler
  const updateIncomeBtn = document.getElementById("updateIncomeBtn");
  if (updateIncomeBtn) {
    updateIncomeBtn.addEventListener("click", async () => {
      const userId = localStorage.getItem("userId");
      if (!userId) {
        showNotification("Please log in to update income", "error");
        return;
      }
      await updateIncome(userId);
      closeModal(document.getElementById("incomeModal"));
    });
  }

  // Expense form setup
  const expenseForm = document.getElementById("expenseForm");
  if (expenseForm) {
    // Add event listener for form submission
    expenseForm.addEventListener("submit", handleExpenseSubmit);

    // Connect the Add Expense button in the modal directly to form submission
    const addExpenseBtn = document.getElementById("addExpenseBtn");
    if (addExpenseBtn) {
      console.log("Setting up expense button click handler");
      addExpenseBtn.addEventListener("click", function () {
        console.log("Add Expense button clicked");
        // Trigger the form submission
        const submitEvent = new Event("submit", { cancelable: true });
        expenseForm.dispatchEvent(submitEvent);
      });
    } else {
      console.error("Add Expense button not found in the DOM");
    }
  } else {
    console.error("Expense form not found in the DOM");
  }
}

// Update dashboard summary
async function updateDashboardSummary() {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    console.log("No userId found when trying to update dashboard summary");
    return;
  }

  try {
    const response = await fetch(`/api/dashboardSummary/${userId}`, {
      headers: addAuthHeader(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error updating dashboard:", errorData);
      throw new Error(errorData.error || "Failed to fetch dashboard summary");
    }

    const data = await response.json();

    // Update summary cards with proper error handling
    const elements = {
      totalIncome: document.getElementById("totalIncome"),
      totalBudgeted: document.getElementById("totalBudgeted"),
      totalExpenses: document.getElementById("totalExpenses"),
      remainingBudget: document.getElementById("remainingBudget"),
    };

    // Update each element if it exists
    if (elements.totalIncome) {
      elements.totalIncome.textContent = `KES ${(
        data.income || 0
      ).toLocaleString()}`;
    }
    if (elements.totalBudgeted) {
      elements.totalBudgeted.textContent = `KES ${(
        data.totalBudgeted || 0
      ).toLocaleString()}`;
    }
    if (elements.totalExpenses) {
      elements.totalExpenses.textContent = `KES ${(
        data.totalExpenses || 0
      ).toLocaleString()}`;
    }
    if (elements.remainingBudget) {
      elements.remainingBudget.textContent = `KES ${(
        data.remainingBudget || 0
      ).toLocaleString()}`;
    }

    // Update progress bars if they exist
    const budgetProgress = document.getElementById("budgetProgress");
    if (budgetProgress && data.income > 0) {
      const percentage = (data.totalBudgeted / data.income) * 100;
      budgetProgress.style.width = `${Math.min(percentage, 100)}%`;
      budgetProgress.setAttribute("aria-valuenow", percentage);
    }

    const expenseProgress = document.getElementById("expenseProgress");
    if (expenseProgress && data.income > 0) {
      const percentage = (data.totalExpenses / data.income) * 100;
      expenseProgress.style.width = `${Math.min(percentage, 100)}%`;
      expenseProgress.setAttribute("aria-valuenow", percentage);

      // Update progress bar color based on spending
      if (percentage > 90) {
        expenseProgress.classList.remove("bg-success", "bg-warning");
        expenseProgress.classList.add("bg-danger");
      } else if (percentage > 75) {
        expenseProgress.classList.remove("bg-success", "bg-danger");
        expenseProgress.classList.add("bg-warning");
      } else {
        expenseProgress.classList.remove("bg-warning", "bg-danger");
        expenseProgress.classList.add("bg-success");
      }
    }
  } catch (error) {
    console.error("Error updating dashboard summary:", error);
    showNotification("Failed to update dashboard: " + error.message, "error");
  }
}

// Update all dashboard components
async function updateDashboard() {
  try {
    const userId = localStorage.getItem("userId");
    if (userId) {
      console.log("Updating dashboard for user:", userId);
      // First update the summary data
      await updateDashboardSummary();
      // Then update the charts
      await updateCharts(userId);
      // Update analytics charts if we're on that tab
      if (document.getElementById("charts").classList.contains("active")) {
        await updateAnalyticsCharts(userId);
      }
    }
  } catch (error) {
    console.error("Error updating dashboard:", error);
    showNotification("Failed to update dashboard: " + error.message, "error");
  }
}

// Add dashboard update triggers with consistent naming
document.addEventListener("budgetAdded", updateDashboard);
document.addEventListener("budgetUpdated", updateDashboard);
document.addEventListener("expenseAdded", updateDashboard);
document.addEventListener("expenseUpdated", updateDashboard);
document.addEventListener("budgetDeleted", updateDashboard);
document.addEventListener("expenseDeleted", updateDashboard);
document.addEventListener("incomeUpdated", updateDashboard);

// Add these helper functions to organize the setup code
function setupNavigation() {
  const navItems = document.querySelectorAll(".sidebar-nav ul li");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetSection = item.getAttribute("data-section");
      console.log("Switching to section:", targetSection);
      switchSection(targetSection);
    });
  });
}

function setupModals() {
  const closeButtons = document.querySelectorAll(".close");
  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const modal = button.closest(".modal");
      closeModal(modal);
    });
  });

  window.addEventListener("click", (e) => {
    const modals = document.querySelectorAll(".modal");
    modals.forEach((modal) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });
}

// Add these functions for analytics charts
async function updateAnalyticsCharts(userId) {
  try {
    console.log("Updating analytics charts for user:", userId);
    await updateMonthlyTrendChart(userId);
    await updateCategoryComparisonChart(userId);
  } catch (error) {
    console.error("Error updating analytics charts:", error);
    showNotification("Failed to update analytics charts", "error");
  }
}

async function updateMonthlyTrendChart(userId) {
  const ctxTrend = document.getElementById("monthlyTrendChart");
  if (!ctxTrend) return;

  try {
    // Get expenses for the last 6 months
    const response = await fetch(`/api/expenses/${userId}`, {
      headers: addAuthHeader(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch expense data");
    }

    const responseData = await response.json();

    // Handle different response formats - ensure we have an array of expenses
    const expenses = Array.isArray(responseData)
      ? responseData
      : responseData.expenses || [];

    console.log("Monthly trend data:", {
      format: typeof responseData,
      isArray: Array.isArray(responseData),
      hasExpensesProperty: responseData && "expenses" in responseData,
      expensesLength: expenses.length,
    });

    // Group expenses by month
    const monthlyData = {};
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    if (Array.isArray(expenses)) {
      expenses.forEach((expense) => {
        const expenseDate = new Date(expense.date);
        if (expenseDate >= sixMonthsAgo) {
          const monthKey = `${expenseDate.getFullYear()}-${(
            expenseDate.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}`;
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
          }
          monthlyData[monthKey] += parseFloat(expense.amount);
        }
      });
    } else {
      console.error("Expenses data is not an array:", expenses);
    }

    // Sort months and prepare chart data
    const sortedMonths = Object.keys(monthlyData).sort();
    const monthLabels = sortedMonths.map((month) => {
      const [year, monthNum] = month.split("-");
      return new Date(year, monthNum - 1).toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
    });
    const monthlyAmounts = sortedMonths.map((month) => monthlyData[month]);

    // Create or update the chart
    if (
      window.monthlyTrendChart &&
      typeof window.monthlyTrendChart.destroy === "function"
    ) {
      window.monthlyTrendChart.destroy();
    } else {
      window.monthlyTrendChart = null;
    }

    window.monthlyTrendChart = new Chart(ctxTrend, {
      type: "line",
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: "Monthly Expenses",
            data: monthlyAmounts,
            borderColor: chartColors.trend.line,
            backgroundColor: chartColors.trend.background,
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
              drawBorder: false,
            },
            ticks: {
              callback: (value) => `KES ${value.toLocaleString()}`,
              font: { size: 12 },
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: { size: 12 },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: "Monthly Expense Trend",
            font: { size: 16, weight: "bold" },
            padding: { top: 20, bottom: 20 },
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            titleFont: { size: 14 },
            bodyFont: { size: 13 },
            callbacks: {
              label: (context) => `KES ${context.raw.toLocaleString()}`,
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("Error updating monthly trend chart:", error);
    showNotification("Failed to update monthly trend chart", "error");
  }
}

async function updateCategoryComparisonChart(userId) {
  const ctxComparison = document.getElementById("categoryComparisonChart");
  if (!ctxComparison) return;

  try {
    // Get both budgets and expenses
    const [budgetResponse, expenseResponse] = await Promise.all([
      fetch(`/api/budgets/${userId}`, { headers: addAuthHeader() }),
      fetch(`/api/expenses/${userId}`, { headers: addAuthHeader() }),
    ]);

    if (!budgetResponse.ok || !expenseResponse.ok) {
      throw new Error("Failed to fetch data");
    }

    const budgets = await budgetResponse.json();
    const expensesData = await expenseResponse.json();

    console.log("Category comparison data:", {
      budgetsFormat: typeof budgets,
      budgetsIsArray: Array.isArray(budgets),
      expensesFormat: typeof expensesData,
      expensesIsArray: Array.isArray(expensesData),
      hasExpensesProperty: expensesData && "expenses" in expensesData,
    });

    // Ensure we have arrays for both budgets and expenses
    const budgetsArray = Array.isArray(budgets) ? budgets : [];
    const expenses = Array.isArray(expensesData)
      ? expensesData
      : expensesData.expenses || [];

    // Group expenses by category
    const expensesByCategory = {};
    if (Array.isArray(expenses)) {
      expenses.forEach((expense) => {
        if (!expensesByCategory[expense.category]) {
          expensesByCategory[expense.category] = 0;
        }
        expensesByCategory[expense.category] += parseFloat(expense.amount);
      });
    } else {
      console.error("Expenses data is not an array:", expenses);
    }

    // Create budget map
    const budgetsByCategory = {};
    budgetsArray.forEach((budget) => {
      budgetsByCategory[budget.category] = parseFloat(budget.amount);
    });

    // Get all unique categories
    const categories = [
      ...new Set([
        ...Object.keys(budgetsByCategory),
        ...Object.keys(expensesByCategory),
      ]),
    ];

    // Prepare data for chart
    const budgetData = categories.map(
      (category) => budgetsByCategory[category] || 0
    );
    const expenseData = categories.map(
      (category) => expensesByCategory[category] || 0
    );
    const utilizationData = categories.map((category, index) => {
      const budget = budgetData[index];
      const expense = expenseData[index];
      return budget > 0 ? (expense / budget) * 100 : 0;
    });

    // Create or update the chart
    if (
      window.categoryComparisonChart &&
      typeof window.categoryComparisonChart.destroy === "function"
    ) {
      window.categoryComparisonChart.destroy();
    } else {
      window.categoryComparisonChart = null;
    }

    window.categoryComparisonChart = new Chart(ctxComparison, {
      type: "bar",
      data: {
        labels: categories,
        datasets: [
          {
            label: "Budget",
            data: budgetData,
            backgroundColor: chartColors.primary.budget.background,
            borderColor: chartColors.primary.budget.border,
            borderWidth: 2,
            order: 2,
          },
          {
            label: "Expenses",
            data: expenseData,
            backgroundColor: chartColors.primary.expense.background,
            borderColor: chartColors.primary.expense.border,
            borderWidth: 2,
            order: 1,
          },
          {
            label: "Utilization %",
            data: utilizationData,
            type: "line",
            borderColor: chartColors.utilization.line,
            borderWidth: 3,
            fill: false,
            yAxisID: "percentage",
            order: 0,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            position: "left",
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
              drawBorder: false,
            },
            ticks: {
              callback: (value) => `KES ${value.toLocaleString()}`,
              font: { size: 12 },
            },
          },
          percentage: {
            beginAtZero: true,
            position: "right",
            max: 100,
            grid: {
              display: false,
            },
            ticks: {
              callback: (value) => `${value.toFixed(0)}%`,
              font: { size: 12 },
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: { size: 12 },
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              padding: 20,
              usePointStyle: true,
              pointStyle: "circle",
              font: { size: 12 },
            },
          },
          title: {
            display: true,
            text: "Budget vs Expense by Category",
            font: { size: 16, weight: "bold" },
            padding: { top: 20, bottom: 20 },
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            titleFont: { size: 14 },
            bodyFont: { size: 13 },
            callbacks: {
              label: (context) => {
                if (context.dataset.label === "Utilization %") {
                  return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                }
                return `${
                  context.dataset.label
                }: KES ${context.raw.toLocaleString()}`;
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("Error updating category comparison chart:", error);
    showNotification("Failed to update category comparison chart", "error");
  }
}

// Function to load budgeted categories for expense form
async function loadBudgetedCategories() {
  try {
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    if (!token || !userId) {
      console.error("No token or userId found in localStorage");
      showNotification("Please log in to view budgeted categories", "error");
      return;
    }

    console.log("Fetching budgeted categories for user:", userId);

    // Fetch both budgets and expenses to calculate remaining amounts
    const [budgetsResponse, expensesResponse] = await Promise.all([
      fetch(`/api/budgets/${userId}`, {
        headers: addAuthHeader({
          "Content-Type": "application/json",
        }),
      }),
      fetch(`/api/expenses/${userId}`, {
        headers: addAuthHeader({
          "Content-Type": "application/json",
        }),
      }),
    ]);

    if (!budgetsResponse.ok) {
      const errorText = await budgetsResponse.text();
      console.error(
        `Failed to fetch budgets: ${budgetsResponse.status}`,
        errorText
      );
      throw new Error("Failed to fetch budgeted categories");
    }

    if (!expensesResponse.ok) {
      const errorText = await expensesResponse.text();
      console.error(
        `Failed to fetch expenses: ${expensesResponse.status}`,
        errorText
      );
      throw new Error("Failed to fetch expenses for categories");
    }

    const budgets = await budgetsResponse.json();
    const expensesData = await expensesResponse.json();

    console.log("Budgets loaded:", budgets);
    console.log("Expenses loaded:", expensesData);

    // Get the expenses array from the response
    const expenses = expensesData.expenses || [];

    // Calculate spent amount per category
    const categorySpent = {};
    expenses.forEach((expense) => {
      const category = expense.category;
      if (!categorySpent[category]) {
        categorySpent[category] = 0;
      }
      categorySpent[category] += parseFloat(expense.amount);
    });

    // Create an array of categories with budget and spent information
    const categories = budgets.map((budget) => {
      const spent = categorySpent[budget.category] || 0;
      const remaining = parseFloat(budget.amount) - spent;

      return {
        category: budget.category,
        budget_amount: parseFloat(budget.amount),
        spent_amount: spent,
        remaining_amount: remaining,
      };
    });

    const categorySelect = document.getElementById("expenseCategory");

    if (!categorySelect) {
      console.error("Category select element not found");
      return;
    }

    // Clear existing options
    categorySelect.innerHTML = '<option value="">Select a Category</option>';

    // Add options for each budgeted category with remaining amount
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.category;

      // Format the remaining amount
      const remaining = parseFloat(category.remaining_amount).toLocaleString();
      const spent = parseFloat(category.spent_amount).toLocaleString();
      const budget = parseFloat(category.budget_amount).toLocaleString();

      // Create a user-friendly label
      option.textContent = `${category.category} (${remaining} KES remaining)`;

      // Add data attributes for use in UI
      option.dataset.spent = category.spent_amount;
      option.dataset.budget = category.budget_amount;
      option.dataset.remaining = category.remaining_amount;

      // Add a class to style categories with low remaining amounts
      if (category.remaining_amount <= 0) {
        option.classList.add("budget-depleted");
      } else if (category.remaining_amount / category.budget_amount < 0.2) {
        option.classList.add("budget-low");
      }

      categorySelect.appendChild(option);
    });

    // Add event listener for category selection to update amount field
    categorySelect.addEventListener("change", function () {
      const selected = this.options[this.selectedIndex];
      const remainingEl = document.getElementById("remainingBudget");

      if (selected && selected.dataset.remaining) {
        if (remainingEl) {
          remainingEl.textContent = `Remaining in budget: KES ${parseFloat(
            selected.dataset.remaining
          ).toLocaleString()}`;
          remainingEl.style.display = "block";

          // Add warning class if remaining budget is low
          if (parseFloat(selected.dataset.remaining) <= 0) {
            remainingEl.classList.add("warning");
          } else {
            remainingEl.classList.remove("warning");
          }
        }
      } else {
        if (remainingEl) {
          remainingEl.style.display = "none";
        }
      }
    });
  } catch (error) {
    console.error("Error loading budgeted categories:", error);
    showNotification(
      "Failed to load budgeted categories. Please check if you have any budgets set up.",
      "error"
    );
  }
}

// Update the expense submission function
async function handleExpenseSubmit(event) {
  try {
    event.preventDefault();
    console.log("Submitting expense form");

    // Get the form data
    const expenseForm = document.getElementById("expenseForm");
    const formData = new FormData(expenseForm);
    const userId = localStorage.getItem("userId");

    if (!userId) {
      showNotification("Please log in to add expenses", "error");
      return;
    }

    // Basic validation
    const category = formData.get("expenseCategory");
    const amount = formData.get("expenseAmount");
    const date = formData.get("expenseDate");
    const description = formData.get("expenseDescription");

    console.log("Form values:", { category, amount, date, description });

    if (!category || !amount || !date) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    // Prepare data for API
    const expenseData = {
      userId: userId,
      category: category,
      amount: parseFloat(amount),
      date: date,
      description: description || "No description",
    };

    console.log("Sending expense data:", expenseData);

    // Call the API to add the expense
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(expenseData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error submitting expense:", response.status, errorText);
      showNotification(
        "Failed to add expense: " + (errorText || response.statusText),
        "error"
      );
      return;
    }

    const result = await response.json();
    console.log("Expense added successfully:", result);
    showNotification("Expense added successfully!", "success");

    // Reset form
    expenseForm.reset();

    // Reload expenses to update the list
    await loadExpenses();

    // Explicitly dispatch events to update charts
    console.log("Dispatching expense events for chart updates");
    document.dispatchEvent(new Event("expenseAdded"));
    document.dispatchEvent(new Event("expenseUpdated"));

    // Update dashboard
    updateDashboard(userId);
  } catch (error) {
    console.error("Error submitting expense:", error);
    showNotification("Failed to add expense: " + error.message, "error");
  }
}

async function submitBudgetForm(event) {
  try {
    event.preventDefault();
    console.log("Submitting budget form");

    // Get form data
    const budgetForm = document.getElementById("budgetForm");
    const formData = new FormData(budgetForm);
    const userId = localStorage.getItem("userId");

    if (!userId) {
      showNotification("Please log in to add a budget", "error");
      return;
    }

    // Basic validation
    const category = formData.get("category");
    const amount = formData.get("amount");
    const period = formData.get("period") || "monthly";

    if (!category || !amount) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    // Prepare data for API
    const budgetData = {
      userId: userId,
      category: category,
      amount: parseFloat(amount),
      period: period,
    };

    console.log("Sending budget data:", budgetData);

    // Call the API to add the budget
    const response = await fetch("/api/budgets", {
      method: "POST",
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(budgetData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error submitting budget:", response.status, errorText);
      showNotification(
        "Failed to add budget: " + (errorText || response.statusText),
        "error"
      );
      return;
    }

    const result = await response.json();
    console.log("Budget added successfully:", result);
    showNotification("Budget added successfully!", "success");

    // Reset form
    budgetForm.reset();

    // Reload budgets to update the list
    await loadBudgets();

    // Explicitly dispatch events to update charts
    console.log("Dispatching budget events for chart updates");
    document.dispatchEvent(new Event("budgetAdded"));
    document.dispatchEvent(new Event("budgetUpdated"));

    // Update dashboard
    updateDashboard(userId);
  } catch (error) {
    console.error("Error submitting budget:", error);
    showNotification("Failed to add budget: " + error.message, "error");
  }
}
