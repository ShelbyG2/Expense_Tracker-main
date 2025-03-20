// Check if user is authenticated
function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

// Add authentication header to fetch requests
function addAuthHeader(headers = {}) {
  const token = localStorage.getItem("token");
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

// Handle unauthorized responses
function handleUnauthorized() {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  window.location.href = "/login.html";
}

// Logout function
function logout() {
  // Show confirmation dialog
  if (confirm("Are you sure you want to logout?")) {
    // Clear all authentication data
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("username");

    // Clear any session data if it exists
    sessionStorage.clear();

    // Redirect to login page
    window.location.href = "/login.html";
  }
}

// Update auth buttons visibility
function updateAuthButtons() {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (loginBtn && logoutBtn) {
    const isAuthenticated = !!localStorage.getItem("token");
    loginBtn.style.display = isAuthenticated ? "none" : "block";
    logoutBtn.style.display = isAuthenticated ? "block" : "none";
  }
}

// Prevent back navigation to login page when authenticated
function preventBackToLogin() {
  window.addEventListener("popstate", function (event) {
    const isAuthenticated = !!localStorage.getItem("token");
    if (isAuthenticated && window.location.pathname.includes("login.html")) {
      // Push a new state to prevent going back to login
      history.pushState(null, "", window.location.href);
    }
  });
}

// Check authentication on page load for protected pages
document.addEventListener("DOMContentLoaded", () => {
  // Skip auth check for login page
  if (window.location.pathname.includes("login.html")) {
    return;
  }

  if (!checkAuth()) {
    return;
  }

  // Update auth buttons visibility
  updateAuthButtons();

  // Add logout functionality to logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }

  // Prevent back navigation to login page
  preventBackToLogin();

  // Push initial state to prevent back navigation
  history.pushState(null, "", window.location.href);
});
