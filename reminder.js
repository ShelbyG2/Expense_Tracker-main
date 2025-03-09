document.addEventListener("DOMContentLoaded", () => {
  const reminderForm = document.getElementById("reminderForm");
  const reminderList = document.getElementById("reminderList");

  reminderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = document.getElementById("reminderAmount").value;
    const date = document.getElementById("reminderDate").value;

    if (amount && date) {
      const listItem = document.createElement("li");
      listItem.className = "list-group-item";
      listItem.innerHTML = `<strong>Amount:</strong> $${amount} <strong>Date:</strong> ${date}`;
      reminderList.appendChild(listItem);

      reminderForm.reset();
    }
  });
});
