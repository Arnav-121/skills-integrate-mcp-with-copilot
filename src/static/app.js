document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authMessage = document.getElementById("auth-message");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const toggleAuthMode = document.getElementById("toggle-auth-mode");
  const logoutButton = document.getElementById("logout-button");
  const activitiesContainer = document.getElementById("activities-container");
  const signupContainer = document.getElementById("signup-container");
  const adminContainer = document.getElementById("admin-container");
  const userInfo = document.getElementById("user-info");
  const userCard = document.getElementById("user-card");
  const adminForm = document.getElementById("admin-activity-form");

  let authMode = "login";
  let currentUser = null;
  let token = localStorage.getItem("token") || "";

  function showMessage(container, text, type = "info") {
    container.textContent = text;
    container.className = `message ${type}`;
    container.classList.remove("hidden");

    window.setTimeout(() => {
      container.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const isAuthenticated = Boolean(currentUser);
    if (isAuthenticated) {
      loginForm.classList.add("hidden");
      registerForm.classList.add("hidden");
      toggleAuthMode.classList.add("hidden");
      logoutButton.classList.remove("hidden");
      activitiesContainer.classList.remove("hidden");
      signupContainer.classList.remove("hidden");
      userInfo.classList.remove("hidden");

      userCard.innerHTML = `
        <h4>Signed in as ${currentUser.email}</h4>
        <p><strong>Role:</strong> ${currentUser.role}</p>
      `;

      if (currentUser.role === "admin") {
        adminContainer.classList.remove("hidden");
      } else {
        adminContainer.classList.add("hidden");
      }
    } else {
      loginForm.classList.remove("hidden");
      toggleAuthMode.classList.remove("hidden");
      logoutButton.classList.add("hidden");
      activitiesContainer.classList.add("hidden");
      signupContainer.classList.add("hidden");
      adminContainer.classList.add("hidden");
      userInfo.classList.add("hidden");
    }
  }

  async function apiFetch(url, options = {}) {
    const headers = options.headers || {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  async function loadCurrentUser() {
    if (!token) {
      currentUser = null;
      updateAuthUI();
      return;
    }

    try {
      const response = await apiFetch("/auth/me");
      if (!response.ok) {
        throw new Error("Failed to verify session");
      }

      currentUser = await response.json();
      updateAuthUI();
      fetchActivities();
    } catch (error) {
      logout();
    }
  }

  async function fetchActivities() {
    if (!currentUser) {
      activitiesList.innerHTML = "<p>Please log in to view available activities.</p>";
      return;
    }

    try {
      const response = await apiFetch("/activities");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Unable to load activities");
      }

      const activities = await response.json();
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const participantsHTML = details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants.map((email) => `<li><span class="participant-email">${email}</span>${currentUser.email === email ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}</li>`).join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");

    try {
      const response = await apiFetch(`/activities/${encodeURIComponent(activity)}/unregister`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(messageDiv, "Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Login failed");
      }

      token = result.access_token;
      localStorage.setItem("token", token);
      currentUser = { email: result.email, role: result.role };
      updateAuthUI();
      fetchActivities();
      showMessage(authMessage, `Welcome, ${currentUser.email}!`, "success");
    } catch (error) {
      showMessage(authMessage, error.message, "error");
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    try {
      const response = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Registration failed");
      }

      token = result.access_token;
      localStorage.setItem("token", token);
      currentUser = { email: result.email, role: result.role };
      updateAuthUI();
      fetchActivities();
      showMessage(authMessage, "Registration successful. You are now logged in.", "success");
    } catch (error) {
      showMessage(authMessage, error.message, "error");
    }
  });

  toggleAuthMode.addEventListener("click", () => {
    if (authMode === "login") {
      authMode = "register";
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
      toggleAuthMode.textContent = "Switch to Log In";
    } else {
      authMode = "login";
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
      toggleAuthMode.textContent = "Switch to Register";
    }
  });

  logoutButton.addEventListener("click", () => {
    logout();
  });

  async function logout() {
    token = "";
    currentUser = null;
    localStorage.removeItem("token");
    updateAuthUI();
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const activity = document.getElementById("activity").value;

    try {
      const response = await apiFetch(`/activities/${encodeURIComponent(activity)}/signup`, {
        method: "POST",
      });

      const result = await response.json();
      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(messageDiv, "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("admin-name").value.trim();
    const description = document.getElementById("admin-description").value.trim();
    const schedule = document.getElementById("admin-schedule").value.trim();
    const maxParticipants = Number(document.getElementById("admin-max").value);

    try {
      const response = await apiFetch("/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, schedule, max_participants: maxParticipants }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Failed to create activity");
      }

      showMessage(authMessage, result.message, "success");
      adminForm.reset();
      fetchActivities();
    } catch (error) {
      showMessage(authMessage, error.message, "error");
    }
  });

  loadCurrentUser();
});
