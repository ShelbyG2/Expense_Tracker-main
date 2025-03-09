document.addEventListener("DOMContentLoaded", () => {
  const ctx = document.getElementById("expenseChart").getContext("2d");
  const expenseChart = new Chart(ctx, {
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

  function updateChart() {
    const categories = [
      ...new Set(expenses.map((expense) => expense.category)),
    ];
    const data = categories.map((category) => {
      return expenses
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0);
    });

    expenseChart.data.labels = categories;
    expenseChart.data.datasets[0].data = data;
    expenseChart.update();
  }

  // Call updateChart whenever expenses are added or removed
  window.addExpense = function () {
    updateChart();
  };

  window.deleteExpense = function (index) {
    updateChart();
  };
});
