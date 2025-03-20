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

// Function to add authentication header
function addAuthHeader(headers = {}) {
  const token = localStorage.getItem("token");
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
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
    const response = await fetch("/addExpense", {
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
      updateCharts(userId);
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

    const response = await fetch("/getExpenses", {
      method: "GET",
      headers: addAuthHeader({
        "Content-Type": "application/json",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch expenses");
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
          <span class="item-amount">Ksh ${parseFloat(expense.amount).toFixed(
            2
          )}</span>
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

    updateExpenseSummary(expenses);
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
    const response = await fetch(`/deleteExpense/${expenseId}`, {
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

// Function to add a new budget (now adds to expenses)
async function addBudget(userId) {
  const frequency = document.getElementById("budgetFrequency").value;
  const category = document.getElementById("budgetCategory").value;
  const amount = document.getElementById("budgetAmount").value;
  const date = new Date().toISOString().split("T")[0]; // Get current date

  if (!frequency || !category || !amount) {
    showNotification("Please fill in all required fields", "error");
    return;
  }

  try {
    const response = await fetch("/addBudget", {
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
      updateCharts(userId);
      // Don't reset the form to allow for similar entries
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
    const response = await fetch("/updateIncome", {
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

// Function to load income
async function loadIncome() {
  try {
    const response = await fetch("/getIncome", {
      headers: addAuthHeader(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch income");
    }

    const data = await response.json();
    income = data.income || 0; // Update the global income variable
    incomeInput.value = income; // Update the input field

    // Update the last modified time if available
    if (data.modified_at) {
      const modifiedDate = new Date(data.modified_at).toLocaleString();
      const incomeContainer = document.querySelector(".income-container");
      if (incomeContainer) {
        const lastModified = document.createElement("small");
        lastModified.className = "last-modified";
        lastModified.textContent = `Last modified: ${modifiedDate}`;
        incomeContainer.appendChild(lastModified);
      }
    }

    return income;
  } catch (error) {
    console.error("Error loading income:", error);
    showNotification("Failed to load income", "error");
    return 0;
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

      // Format the modified date
      const modifiedDate = new Date(budget.modified_at).toLocaleString();

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
                  <div><small>Last modified: ${modifiedDate}</small></div>
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
    const response = await fetch(`/deleteBudget/${budgetId}`, {
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
    // Fetch latest expenses from the database
    const response = await fetch("/getExpenses", {
      headers: addAuthHeader(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch expenses for charts");
    }

    const expenses = await response.json();

    // Group expenses by category
    const categoryTotals = expenses.reduce((acc, expense) => {
      if (!acc[expense.category]) {
        acc[expense.category] = 0;
      }
      acc[expense.category] += parseFloat(expense.amount);
      return acc;
    }, {});

    // Get unique categories and their totals
    const categories = Object.keys(categoryTotals);
    const amounts = Object.values(categoryTotals);

    // Update bar chart
    expenseChart.data.labels = categories;
    expenseChart.data.datasets[0].data = amounts;
    expenseChart.update();

    // Update pie chart
    expensePieChart.data.labels = categories;
    expensePieChart.data.datasets[0].data = amounts;
    expensePieChart.update();
  } catch (error) {
    console.error("Error updating charts:", error);
    showNotification("Failed to update charts", "error");
  }
}

// Initialize the charts with better styling
document.addEventListener("DOMContentLoaded", () => {
  const ctxBar = document.getElementById("expenseChart").getContext("2d");
  window.expenseChart = new Chart(ctxBar, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Expenses by Category",
          data: [],
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
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
              return "Ksh " + value.toFixed(2);
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              return "Ksh " + context.raw.toFixed(2);
            },
          },
        },
      },
    },
  });

  const ctxPie = document.getElementById("expensePieChart").getContext("2d");
  window.expensePieChart = new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: [],
      datasets: [
        {
          label: "Expenses by Category",
          data: [],
          backgroundColor: [
            "rgba(255, 99, 132, 0.2)",
            "rgba(54, 162, 235, 0.2)",
            "rgba(255, 206, 86, 0.2)",
            "rgba(75, 192, 192, 0.2)",
            "rgba(153, 102, 255, 0.2)",
            "rgba(255, 159, 64, 0.2)",
          ],
          borderColor: [
            "rgba(255, 99, 132, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(75, 192, 192, 1)",
            "rgba(153, 102, 255, 1)",
            "rgba(255, 159, 64, 1)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${context.label}: Ksh ${value.toFixed(
                2
              )} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
});

// Update the event listener for the budget form
budgetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userId = localStorage.getItem("userId");
  if (!userId) {
    showNotification("Please log in to add a budget", "error");
    return;
  }
  await addBudget(userId);
});

// Update the event listener for the expense form
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userId = localStorage.getItem("userId");
  if (!userId) {
    showNotification("Please log in to add an expense", "error");
    return;
  }
  await addExpense(userId);
});

// Load budgets for the current user
async function loadBudgets() {
  try {
    const response = await fetch("/getBudgets", {
      headers: addAuthHeader(),
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
          <span class="item-amount">Ksh ${parseFloat(budget.amount).toFixed(
            2
          )}</span>
          <span class="item-frequency">${budget.frequency}</span>
        </div>
        <button class="delete-btn" onclick="deleteBudget(${budget.id})">
          <i class="fas fa-trash"></i>
        </button>
      `;
      budgetList.appendChild(li);
    });

    updateBudgetSummary(budgets);
  } catch (error) {
    console.error("Error loading budgets:", error);
    showNotification("Failed to load budgets", "error");
  }
}

// Update budget summary
function updateBudgetSummary(budgets) {
  const totalBudgeted = budgets.reduce(
    (sum, budget) => sum + parseFloat(budget.amount),
    0
  );
  const totalBudgetedElement = document.getElementById("totalBudgeted");
  totalBudgetedElement.textContent = `Ksh ${totalBudgeted.toFixed(2)}`;

  // Get the current income value from the input field
  const income = parseFloat(document.getElementById("income").value) || 0;

  // Update remaining budget using the current income value
  const totalExpenses =
    parseFloat(
      document.getElementById("totalExpenses").textContent.replace("Ksh ", "")
    ) || 0;
  const remaining = income - totalExpenses;
  const remainingBudgetElement = document.getElementById("remainingBudget");
  remainingBudgetElement.textContent = `Ksh ${remaining.toFixed(2)}`;

  // Update the color based on remaining budget
  remainingBudgetElement.className = `amount ${
    remaining >= 0 ? "positive" : "negative"
  }`;
}

// Update the event listener for income input
incomeInput.addEventListener("change", () => {
  const userId = localStorage.getItem("userId");
  if (userId) {
    updateIncome(userId);
  }
});

// Update the loadInitialData function
async function loadInitialData() {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    showNotification("Please log in to view your data", "error");
    return;
  }

  try {
    // Load income first
    await loadIncome();

    // Then load other data
    await loadBudgets();
    await loadExpenses();

    // Update charts with the loaded data
    updateCharts(userId);
  } catch (error) {
    console.error("Error loading initial data:", error);
    showNotification(
      "Failed to load data. Please try refreshing the page.",
      "error"
    );
  }
}

// Call loadInitialData when the page loads
document.addEventListener("DOMContentLoaded", loadInitialData);
