"use strict";

const loginView = document.getElementById("login-view");
const loginForm = document.getElementById("login-form");
const deviceInput = document.getElementById("login-device");
const usernameInput = document.getElementById("login-username");
const passwordInput = document.getElementById("login-password");
const rememberInput = document.getElementById("login-remember");
const logoutButton = document.getElementById("logout");
const connectedDevice = document.getElementById("connected-device");

function showLogin() {
  document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
  document.querySelector("nav").hidden = true;
  document.getElementById("device-content").hidden = true;
  document.querySelectorAll("[id^='tab-']").forEach(tab => { tab.hidden = true; });
  connectedDevice.hidden = true;
  connectedDevice.textContent = "";
  logoutButton.hidden = true;
  passwordInput.value = "";
  loginView.hidden = false;
}

async function refreshSession() {
  const session = await apiFetch("/session", { cache: "no-store" });
  if (!session.loggedIn) {
    showLogin();
    return;
  }
  loginView.hidden = true;
  passwordInput.value = "";
  connectedDevice.textContent = `Connected to ${session.deviceUrl}`;
  connectedDevice.hidden = false;
  logoutButton.hidden = false;
  document.querySelector("nav").hidden = false;
  document.getElementById("device-content").hidden = false;
  activateTab("users");
}

function rememberLogin() {
  try {
    if (rememberInput.checked) {
      localStorage.setItem("deviceUrl", deviceInput.value);
      localStorage.setItem("username", usernameInput.value);
    } else {
      localStorage.removeItem("deviceUrl");
      localStorage.removeItem("username");
    }
  } catch (_) { /* Storage can be disabled; authentication still works. */ }
}

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  runAction(document.getElementById("login-submit"), async () => {
    rememberLogin();
    // Only this in-memory request carries the password. Clear the form before
    // awaiting a response; never pass credentials to storage or diagnostics.
    const request = jsonOptions("POST", {
      deviceUrl: deviceInput.value, username: usernameInput.value, password: passwordInput.value
    });
    passwordInput.value = "";
    try { await apiFetch("/login", request); }
    finally { request.body = ""; }
    // Existing tabs retain device-specific state (including newly added card
    // IDs). Start a fresh page after switching sessions; its initial /session
    // check reveals the UI only after all tab state has been reset.
    location.reload();
  });
});

rememberInput.addEventListener("change", () => {
  if (!rememberInput.checked) rememberLogin();
});
logoutButton.addEventListener("click", () => runAction(logoutButton, async () => {
  try { await apiFetch("/logout", { method: "POST" }); }
  finally { showLogin(); }
}));
document.addEventListener("session-expired", showLogin);
window.addEventListener("pagehide", () => { passwordInput.value = ""; });
document.addEventListener("DOMContentLoaded", async () => {
  passwordInput.value = "";
  try {
    deviceInput.value = localStorage.getItem("deviceUrl") || "";
    usernameInput.value = localStorage.getItem("username") || "Admin";
    rememberInput.checked = Boolean(localStorage.getItem("deviceUrl"));
  } catch (_) { /* Storage is optional. */ }
  if (location.protocol === "file:") { showLogin(); return; }
  try { await refreshSession(); } catch (_) { showLogin(); }
});
