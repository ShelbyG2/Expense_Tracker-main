// Global variables to store expenses and budgets
let expenses = [];
let budgets = [];
let income = 0;

// DOM elements
const expenseForm = document.getElementById("expenseForm");
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
    const response = await fetch(`/api/income/${userId}`, {
      headers: addAuthHeader(),
    });

    if (!response.ok) throw new Error("Failed to fetch income");

    const data = await response.json();
    updateIncomeDisplay(data.amount);
  } catch (error) {
    console.error("Error loading income:", error);
    showNotification("Failed to load income", "error");
  }
}

// Chart Update Functions
async function updateCharts(userId) {
  try {
    await Promise.all([
      updateExpensePieChart(userId),
      updateBudgetVsExpenseChart(userId),
      updateMonthlyTrendChart(userId),
      updateCategoryComparisonChart(userId),
    ]);
  } catch (error) {
    console.error("Error updating charts:", error);
    showNotification("Failed to update charts", "error");
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
  const expenseForm = document.getElementById("expenseForm");

  budgetForm?.addEventListener("submit", handleBudgetSubmit);
  expenseForm?.addEventListener("submit", handleExpenseSubmit);
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
document.addEventListener("DOMContentLoaded", () => {
  if (checkAuthentication()) {
    setupEventListeners();
    loadInitialData();
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
  addExpense(userId);
});

document.getElementById("income").addEventListener("change", () => {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    showNotification("Please log in to update income", "error");
    return;
  }
  updateIncome(userId);
});

// Function to add a new expense
async function addExpense(userId) {
  const date = document.getElementById("expenseDate").value;
  const description = document.getElementById("expenseDescription").value;
  const category = document.getElementById("expenseCategory").value;
  const amount = document.getElementById("expenseAmount").value;

  if (!date || !description || !category || !amount) {
    showNotification("Please fill in all required fields", "error");
    return;
  }

  try {
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        userId,
        date,
        description,
        category,
        amount: parseFloat(amount),
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showNotification(data.message || "Expense added successfully", "success");
      // Reset the form
      document.getElementById("expenseForm").reset();
      // Reload expenses and update UI
      await loadExpenses();
      await updateDashboardSummary();
      await updateCharts(userId);
    } else {
      showNotification(data.message || "Failed to add expense", "error");
      // If the error is about missing budget, highlight the category field
      if (
        data.message &&
        data.message.includes("No budget found for category")
      ) {
        const categoryInput = document.getElementById("expenseCategory");
        categoryInput.classList.add("error");
        setTimeout(() => {
          categoryInput.classList.remove("error");
        }, 3000);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to add expense", "error");
  }
}

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

    const expenses = await response.json();
    const expenseList = document.getElementById("expenseList");
    expenseList.innerHTML = "";

    if (!Array.isArray(expenses) || expenses.length === 0) {
      expenseList.innerHTML = '<li class="list-item">No expenses found</li>';
      return;
    }

    expenses.forEach((expense) => {
      const li = document.createElement("li");
      li.className = "list-item";
      const formattedDate = new Date(expense.date).toLocaleDateString();

      li.innerHTML = `
        <div class="item-content">
          <span class="item-category">${expense.description}</span>
          <span class="item-amount">KES ${parseFloat(
            expense.amount
          ).toLocaleString()}</span>
          <span class="item-frequency">${formattedDate} | ${
        expense.category
      }</span>
        </div>
        <button class="delete-btn" onclick="deleteExpense(${expense.id})">
          <i class="fas fa-trash"></i>
        </button>
      `;
      expenseList.appendChild(li);
    });

    // Update expense summary
    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + parseFloat(expense.amount),
      0
    );
    document.getElementById(
      "totalExpenses"
    ).textContent = `KES ${totalExpenses.toLocaleString()}`;

    // Trigger chart update
    const event = new Event("expenseUpdated");
    document.dispatchEvent(event);
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

// Function to update the charts
async function updateCharts(userId) {
  try {
    console.log("Updating charts for user:", userId);
    const budgetData = await getBudgetData(userId);
    const expenseData = await getExpenseData(userId);

    console.log("Chart data:", { budgetData, expenseData });

    if (!budgetData || !expenseData) {
      console.error("Failed to fetch chart data");
      return;
    }

    // Update expense pie chart
    const ctxPie = document.getElementById("expensePieChart");
    if (ctxPie) {
      console.log("Initializing expense pie chart");
      if (expensePieChart) {
        expensePieChart.destroy();
      }

      if (expenseData.labels.length === 0) {
        // Display a message when no data is available
        const ctx = ctxPie.getContext("2d");
        ctx.font = "16px Arial";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText(
          "No expense data available",
          ctxPie.width / 2,
          ctxPie.height / 2
        );
      } else {
        expensePieChart = new Chart(ctxPie, {
          type: "pie",
          data: {
            labels: expenseData.labels,
            datasets: [
              {
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
                labels: {
                  font: { size: 12 },
                  padding: 20,
                  usePointStyle: true,
                  pointStyle: "circle",
                },
              },
              title: {
                display: true,
                text: "Expense Distribution",
                font: { size: 16, weight: "bold" },
                padding: { top: 20, bottom: 20 },
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    const value = context.raw;
                    const total = context.dataset.data.reduce(
                      (a, b) => a + b,
                      0
                    );
                    const percentage = ((value / total) * 100).toFixed(1);
                    return `${
                      context.label
                    }: KES ${value.toLocaleString()} (${percentage}%)`;
                  },
                },
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                padding: 12,
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
              },
            },
          },
        });
      }
    }

    // Update budget vs expense bar chart
    const ctxBar = document.getElementById("budgetVsExpenseChart");
    if (ctxBar) {
      console.log("Initializing budget vs expense chart");
      if (budgetVsExpenseChart) {
        budgetVsExpenseChart.destroy();
      }

      const allCategories = [
        ...new Set([...budgetData.labels, ...expenseData.labels]),
      ];

      if (allCategories.length === 0) {
        // Display a message when no data is available
        const ctx = ctxBar.getContext("2d");
        ctx.font = "16px Arial";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText(
          "No budget or expense data available",
          ctxBar.width / 2,
          ctxBar.height / 2
        );
      } else {
        const budgetValues = allCategories.map((category) => {
          const index = budgetData.labels.indexOf(category);
          return index !== -1 ? budgetData.values[index] : 0;
        });

        const expenseValues = allCategories.map((category) => {
          const index = expenseData.labels.indexOf(category);
          return index !== -1 ? expenseData.values[index] : 0;
        });

        budgetVsExpenseChart = new Chart(ctxBar, {
          type: "bar",
          data: {
            labels: allCategories,
            datasets: [
              {
                label: "Budget",
                data: budgetValues,
                backgroundColor: chartColors.primary.budget.background,
                borderColor: chartColors.primary.budget.border,
                borderWidth: 2,
              },
              {
                label: "Expenses",
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
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function (value) {
                    return "KES " + value.toLocaleString();
                  },
                },
              },
            },
            plugins: {
              legend: {
                position: "top",
              },
              title: {
                display: true,
                text: "Budget vs Expenses by Category",
                font: {
                  size: 16,
                },
              },
            },
          },
        });
      }
    }
  } catch (error) {
    console.error("Error updating charts:", error);
    showNotification("Failed to update charts: " + error.message, "error");
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

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error("Invalid expense data format:", data);
      return null;
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
    return null;
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
      showNotification("Please log in to view budgets", "error");
      return;
    }

    const response = await fetch(`/api/budgets/${userId}`, {
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch budgets");
    }

    const budgets = await response.json();
    const budgetList = document.getElementById("budgetList");
    budgetList.innerHTML = "";

    if (!Array.isArray(budgets) || budgets.length === 0) {
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

    // Trigger chart update
    const event = new Event("budgetUpdated");
    document.dispatchEvent(event);
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
}

// Setup form handlers
function setupFormHandlers() {
  // Budget form handler
  const budgetForm = document.getElementById("budgetForm");
  budgetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem("userId");
    if (!userId) {
      showNotification("Please log in to add a budget", "error");
      return;
    }
    await addBudget(userId);
    closeModal(budgetForm.closest(".modal"));
  });

  // Expense form handler
  const addExpenseBtn = document.getElementById("addExpenseBtn");
  addExpenseBtn.addEventListener("click", async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      showNotification("Please log in to add an expense", "error");
      return;
    }
    await addExpense(userId);
    closeModal(document.getElementById("expenseModal"));
  });
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
  const userId = localStorage.getItem("userId");
  if (userId) {
    await Promise.all([updateDashboardSummary(), updateCharts(userId)]);
  }
}

// Add dashboard update triggers
document.addEventListener("budgetAdded", updateDashboard);
document.addEventListener("expenseAdded", updateDashboard);
document.addEventListener("budgetDeleted", updateDashboard);
document.addEventListener("expenseDeleted", updateDashboard);
document.addEventListener("incomeUpdated", updateDashboard);

// Update dashboard on initial load
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Page loaded, checking authentication...");

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
  } else {
    console.log("User is not authenticated");
  }
});

// Add these helper functions to organize the setup code
function setupNavigation() {
  const navItems = document.querySelectorAll(".sidebar-nav ul li");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((navItem) => navItem.classList.remove("active"));
      item.classList.add("active");
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

    const expenses = await response.json();

    // Group expenses by month
    const monthlyData = {};
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

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
    if (monthlyTrendChart) {
      monthlyTrendChart.destroy();
    }

    monthlyTrendChart = new Chart(ctxTrend, {
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
    const expenses = await expenseResponse.json();

    // Group expenses by category
    const expensesByCategory = {};
    expenses.forEach((expense) => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = 0;
      }
      expensesByCategory[expense.category] += parseFloat(expense.amount);
    });

    // Create budget map
    const budgetsByCategory = {};
    budgets.forEach((budget) => {
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
    if (categoryComparisonChart) {
      categoryComparisonChart.destroy();
    }

    categoryComparisonChart = new Chart(ctxComparison, {
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
