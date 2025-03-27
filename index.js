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

signInForm.addEventListener("submit", login);

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
    console.log("Attempting to sign up user:", username);
    const response = await fetch("/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();
    console.log("Signup response:", data);

    if (response.ok) {
      container.classList.remove("sign-up-mode");
      showNotification("Registration successful! Please log in.", "success");
      // Clear the form
      signUpForm.reset();
    } else {
      showNotification(data.message || "Registration failed", "error");
    }
  } catch (error) {
    console.error("Signup error:", error);
    showNotification("An error occurred during registration", "error");
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

// Add this at the top of the file
async function checkServerHealth() {
  try {
    const response = await fetch("/api/health");
    return response.ok;
  } catch (error) {
    console.error("Server health check failed:", error);
    return false;
  }
}

// Update the login function to use the correct form selectors
async function login(event) {
  event.preventDefault();
  const username = signInForm.querySelector("input[name='username']").value;
  const password = signInForm.querySelector("input[name='password']").value;
  const loginButton = signInForm.querySelector('input[type="submit"]');

  if (!username || !password) {
    showNotification("Please enter both username and password", "error");
    return;
  }

  try {
    loginButton.disabled = true;
    loginButton.value = "Signing in...";

    // Check server health first
    const healthResponse = await fetch("/api/health");
    if (!healthResponse.ok) {
      throw new Error("Server is not responding");
    }

    const response = await fetch("/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    console.log("Login response:", data);

    if (data.success) {
      // Store user data
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("username", data.username);

      // Apply user settings if available
      if (data.settings) {
        localStorage.setItem("userSettings", JSON.stringify(data.settings));
        if (data.settings.theme) {
          document.body.setAttribute("data-theme", data.settings.theme);
        }
      }

      showNotification("Login successful!", "success");
      window.location.href = "/home";
    } else {
      showNotification(data.message || "Login failed", "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    showNotification(
      error.message || "Login failed. Please try again.",
      "error"
    );
  } finally {
    loginButton.disabled = false;
    loginButton.value = "Sign In";
  }
}
