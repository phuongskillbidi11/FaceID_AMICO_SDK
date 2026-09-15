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

// Only constant, locally authored paths enter SVG markup; user data stays textContent.
const booleanPaths = { yes: '<path d="m4 12 5 5L20 6"/>', no: '<path d="m6 6 12 12M18 6 6 18"/>' };
// value: true (green check) | false (red X) | null (grey X, e.g. "not recognized" --
// a real third state on the real device's own Access Logs report, not just yes/no).
function booleanIcon(value, yesLabel, noLabel, neutralLabel) {
  const cls = value === true ? "icon-yes" : value === false ? "icon-no" : "icon-neutral";
  const label = value === true ? yesLabel : value === false ? noLabel : (neutralLabel ?? noLabel);
  const path = value === true ? booleanPaths.yes : booleanPaths.no;
  const icon = element("span", undefined, cls);
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", label);
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
  return icon;
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

function setNavGroupExpanded(toggle, expanded) {
  const submenu = document.getElementById(toggle.getAttribute("aria-controls"));
  toggle.setAttribute("aria-expanded", String(expanded));
  submenu.hidden = !expanded;
}

document.getElementById("dismiss-error").addEventListener("click", hideError);
document.querySelectorAll("nav [data-tab]").forEach(button => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});
document.querySelectorAll(".nav-group-toggle").forEach(toggle => {
  toggle.addEventListener("click", () => {
    setNavGroupExpanded(toggle, toggle.getAttribute("aria-expanded") !== "true");
  });
});

