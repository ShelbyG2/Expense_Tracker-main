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
  const username = signInForm.querySelector("input[type='text']").value;
  const password = signInForm.querySelector("input[type='password']").value;
  console.log("Sign-in form submitted:", { username, password }); // Log form data
  if (username === "" || password === "") {
    showNotification("Please fill in all fields", "error");
  } else {
    try {
      const response = await fetch("/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.text();
      console.log("Sign-in response:", data); // Log response data
      if (response.ok) {
        showNotification(data, "success");
        window.location.href = "./homepage.html";
      } else {
        showNotification(data, "error");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }
});

signUpForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = signUpForm.querySelector("input[type='text']").value;
  const email = signUpForm.querySelector("input[type='email']").value;
  const password = signUpForm.querySelector("input[type='password']").value;
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
    showNotification(data, "success");
  } catch (error) {
    console.error("Error:", error);
  }
}
