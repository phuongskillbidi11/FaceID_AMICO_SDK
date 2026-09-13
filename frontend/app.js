"use strict";

function showError(message) {
  document.getElementById("error-message").textContent = message;
  document.getElementById("error-banner").hidden = false;
  // Native dialogs cover the page banner; mirror it inside the dialog.
  document.querySelectorAll(".dialog-error").forEach(node => {
    node.textContent = message;
    node.hidden = false;
  });
}

function hideError() {
  document.getElementById("error-banner").hidden = true;
  document.getElementById("error-message").textContent = "";
  document.querySelectorAll(".dialog-error").forEach(node => {
    node.hidden = true;
    node.textContent = "";
  });
}

async function apiFetch(path, options = {}) {
  // No request logging. Suppress server text on PIN errors to prevent echoes.
  const sensitive = /\/password(?:\?|$)/.test(path);
  try {
    const response = await fetch(path, options);
    if (response.status === 401 && !/^\/(login|session)(?:\?|$)/.test(path)) {
      document.dispatchEvent(new Event("session-expired"));
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(sensitive ? "Unable to set PIN. Please try again." :
        `${body.type ? body.type + ": " : ""}${body.error || `Request failed (HTTP ${response.status}).`}`);
      error.type = sensitive ? "" : body.type;
      throw error;
    }
    const body = response.status === 204 ? null : await response.json();
    hideError();
    return sensitive ? null : body;
  } catch (error) {
    if (sensitive) error = new Error("Unable to set PIN. Please try again.");
    if (/^\/login(?:\?|$)/.test(path)) error = new Error("Login failed. Check the device URL and credentials.");
    showError(error.message || "Unable to reach the backend.");
    throw error;
  }
}

function jsonOptions(method, body, headers = {}) {
  return { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) };
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text === null ? "—" : String(text);
  if (className) node.className = className;
  return node;
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function runAction(control, action) {
  if (control.disabled) return;
  control.disabled = true;
  try { await action(); } catch (error) { showError(error.message || "Action failed."); }
  finally { control.disabled = false; }
}

function activateTab(name) {
  document.querySelectorAll("nav [data-tab]").forEach(button => {
    const active = button.dataset.tab === name;
    button.setAttribute("aria-pressed", String(active));
    document.getElementById(`tab-${button.dataset.tab}`).hidden = !active;
  });
  // Allow direct-file shell verification without attempting backend requests.
  if (location.protocol !== "file:") document.dispatchEvent(new CustomEvent("tab-activated", { detail: name }));
}

document.getElementById("dismiss-error").addEventListener("click", hideError);
document.querySelectorAll("nav [data-tab]").forEach(button => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

