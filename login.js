const signInBtn = document.getElementById("sign-in-btn");
const signUpBtn = document.getElementById("sign-up-btn");
const container = document.querySelector(".container");

signUpBtn.addEventListener("click", () => {
  container.classList.add("sign-up-mode");
});

signInBtn.addEventListener("click", () => {
  container.classList.remove("sign-up-mode");
});

const signInForm = document.querySelector(".sign-in-form");
const signUpForm = document.querySelector(".sign-up-form");

signInForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = signInForm.querySelector("input[name='username']").value;
  const password = signInForm.querySelector("input[name='password']").value;

  if (username === "" || password === "") {
    showNotification("Please fill in all fields", "error");
    return;
  }

  try {
    const response = await fetch("/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store the JWT token in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId);
      showNotification("Login successful", "success");
      window.location.href = "./homepage.html";
    } else {
      showNotification(data.message || "Login failed", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("An error occurred during login", "error");
  }
});

signUpForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = signUpForm.querySelector("input[name='username']").value;
  const email = signUpForm.querySelector("input[name='email']").value;
  const password = signUpForm.querySelector("input[name='password']").value;
  if (username === "" || email === "" || password === "") {
    showNotification("Please fill in all fields", "error");
  } else if (!validateEmail(email)) {
    showNotification("Please enter a valid email address", "error");
  } else {
    submitSignUpForm(username, email, password);
  }
});

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

async function submitSignUpForm(username, email, password) {
  try {
    const response = await fetch("/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.text();
    container.classList.remove("sign-up-mode");
    showNotification(data, "success");
  } catch (error) {
    console.error("Error:", error);
  }
}

function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `<i class="fas fa-bell"></i> ${message}`;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 3000);
}
