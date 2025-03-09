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

// Add event listeners
document.getElementById("addExpenseBtn").addEventListener("click", addExpense);
document.getElementById("addBudgetBtn").addEventListener("click", addBudget);
document.getElementById("income").addEventListener("change", updateIncome);

// Function to add a new expense
function addExpense() {
  const date = document.getElementById("expenseDate").value;
  const description = document.getElementById("expenseDescription").value;
  const category = document.getElementById("expenseCategory").value;
  const amount = parseFloat(document.getElementById("expenseAmount").value);

  if (!date || !description || !amount) {
    alert("Please fill in all required fields");
    return;
  }

  const expense = {
    date,
    description,
    category,
    amount,
  };

  expenses.push(expense);
  displayExpenses();
  updateSummary();
  updateCharts();

  // Reset form
  expenseForm.reset();
}

// Function to add a new budget
function addBudget() {
  const frequency = document.getElementById("budgetFrequency").value;
  const category = document.getElementById("budgetCategory").value;
  const amount = parseFloat(document.getElementById("budgetAmount").value);

  if (!category || !amount) {
    alert("Please fill in all required fields");
    return;
  }

  // Check if budget for this category already exists
  const existingBudgetIndex = budgets.findIndex((b) => b.category === category);

  if (existingBudgetIndex !== -1) {
    // Update existing budget
    budgets[existingBudgetIndex].amount = amount;
  } else {
    // Add new budget
    const budget = {
      frequency,
      category,
      amount,
    };
    budgets.push(budget);
  }

  displayBudgets();
  updateSummary();

  // Reset form
  budgetForm.reset();
}

// Function to update income
function updateIncome() {
  income = parseFloat(document.getElementById("income").value) || 0;
  updateSummary();
}

// Function to display expenses
function displayExpenses() {
  expenseList.innerHTML = "";

  expenses.forEach((expense, index) => {
    const li = document.createElement("li");
    li.className = "list-group-item";

    const formattedDate = new Date(expense.date).toLocaleDateString();
    li.innerHTML = `
              <div>
                  <strong>${
                    expense.description
                  }</strong> - $${expense.amount.toFixed(2)}
                  <div><small>${formattedDate} | Category: ${
      expense.category
    }</small></div>
              </div>
              <button class="delete-btn" onclick="deleteExpense(${index})">
                  <i class="fas fa-trash"></i>
              </button>
          `;
    expenseList.appendChild(li);
  });
}

// Function to display budgets
function displayBudgets() {
  budgetList.innerHTML = "";

  budgets.forEach((budget, index) => {
    const li = document.createElement("li");
    li.className = "list-group-item";

    // Calculate expenses for this category
    const categoryExpenses = expenses
      .filter((e) => e.category === budget.category)
      .reduce((sum, e) => sum + e.amount, 0);

    const remaining = budget.amount - categoryExpenses;
    const percentUsed =
      budget.amount > 0 ? (categoryExpenses / budget.amount) * 100 : 0;

    li.innerHTML = `
              <div>
                  <strong>${
                    budget.category
                  }</strong> - $${budget.amount.toFixed(2)}
                  <div><small>${
                    budget.frequency
                  } | Spent: $${categoryExpenses.toFixed(
      2
    )} | Remaining: $${remaining.toFixed(2)}</small></div>
                  <div><small>Used: ${percentUsed.toFixed(1)}%</small></div>
              </div>
              <button class="delete-btn" onclick="deleteBudget(${index})">
                  <i class="fas fa-trash"></i>
              </button>
          `;
    budgetList.appendChild(li);
  });
}

// Function to delete an expense
function deleteExpense(index) {
  expenses.splice(index, 1);
  displayExpenses();
  updateSummary();
  updateCharts();
}

// Function to delete a budget
function deleteBudget(index) {
  budgets.splice(index, 1);
  displayBudgets();
  updateSummary();
}

// Function to update summary
function updateSummary() {
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
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
function updateCharts() {
  const categories = [...new Set(expenses.map((expense) => expense.category))];
  const data = categories.map((category) => {
    return expenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0);
  });

  expenseChart.data.labels = categories;
  expenseChart.data.datasets[0].data = data;
  expenseChart.update();

  expensePieChart.data.labels = categories;
  expensePieChart.data.datasets[0].data = data;
  expensePieChart.update();
}

// Initialize the charts
document.addEventListener("DOMContentLoaded", () => {
  const ctxBar = document.getElementById("expenseChart").getContext("2d");
  window.expenseChart = new Chart(ctxBar, {
    type: "bar",
    data: {
      labels: [], // Categories
      datasets: [
        {
          label: "Expenses",
          data: [], // Amounts
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });

  const ctxPie = document.getElementById("expensePieChart").getContext("2d");
  window.expensePieChart = new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: [], // Categories
      datasets: [
        {
          label: "Expenses",
          data: [], // Amounts
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
    },
  });
});
