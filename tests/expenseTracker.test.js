const {
  addExpense,
  deleteExpense,
  getExpenses,
  getTotalExpenses,
} = require("../src/expenseTracker");

describe("Expense Tracker", () => {
  beforeEach(() => {
    // Reset the expenses before each test
    // ...existing code...
  });

  test("should add a new expense", () => {
    const expense = { amount: 50, category: "Food", date: "2023-10-01" };
    addExpense(expense);
    const expenses = getExpenses();
    expect(expenses).toContainEqual(expense);
  });

  test("should delete an expense", () => {
    const expense = { amount: 50, category: "Food", date: "2023-10-01" };
    addExpense(expense);
    deleteExpense(expense);
    const expenses = getExpenses();
    expect(expenses).not.toContainEqual(expense);
  });

  test("should get total expenses", () => {
    addExpense({ amount: 50, category: "Food", date: "2023-10-01" });
    addExpense({ amount: 100, category: "Transport", date: "2023-10-02" });
    const total = getTotalExpenses();
    expect(total).toBe(150);
  });
});
