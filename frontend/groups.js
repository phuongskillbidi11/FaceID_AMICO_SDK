"use strict";

// Groups (Enroll -> Groups) write side, 2026-09-15 plan. Single-field
// object (just `name`) -- no tabs needed, unlike Users/Visitors/Visits.
// Reuses the file-scope input()/actionButton() helpers users.js already
// exports (script load order: users.js before groups.js, see index.html).
// The real device's own UI disables editing/removing whichever group has
// id 1 on this device (a protected system default, `noSave:[1]` in the
// device's own class.js) -- this is a presentation-layer courtesy only,
// not a claim about server-side enforcement; see
// .plans/2026-09-15-groups-write-side/spec.md Decision 2.
const PROTECTED_GROUP_ID = 1;

(() => {
  const tab = document.getElementById("tab-groups");
  const refresh = element("button", "Refresh");
  const add = element("button", "Add Group", "success");
  add.type = refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(add, refresh); tab.append(actions);
  add.addEventListener("click", () => runAction(add, () => openGroupModal(null)));

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Name", "Edit", "Remove"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  let listVersion = 0;
  async function loadItems() {
    const version = ++listVersion;
    const data = await apiFetch("/groups");
    if (version !== listVersion) return;
    const items = data.groups;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      row.append(element("td", item.name));
      const editCell = element("td"); actionButton(editCell, "Edit", () => openGroupModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      if (item.id !== PROTECTED_GROUP_ID) {
        actionButton(removeCell, "Remove", async () => {
          if (!window.confirm(`Remove group "${item.name}"? This permanently deletes the group and cannot be undone.`)) return;
          await apiFetch(`/groups/${item.id}`, { method: "DELETE" });
          await loadItems();
        }, true);
      }
      row.append(removeCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} groups` : "No groups found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "groups") runAction(refresh, loadItems);
  });

  async function openGroupModal(id) {
    let item = id === null ? { name: "" } : (await apiFetch("/groups")).groups.find(g => g.id === id);
    if (document.querySelector("dialog[open]")) return;
    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", id === null ? "Add Group" : `Edit Group — ${item.name}`);
    title.id = "edit-group-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";

    const form = element("form", undefined, "general-form");
    const name = input(form, "Name"); name.value = item.name;
    const protectedGroup = id === PROTECTED_GROUP_ID;
    name.disabled = protectedGroup;
    const save = element("button", "Save"); save.type = "submit"; save.disabled = protectedGroup; form.append(save);
    if (protectedGroup) {
      form.append(element("p", "This is a protected default group and cannot be renamed.", "lock-note"));
    }
    dialog.append(form);

    form.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        if (id === null) {
          await apiFetch("/groups", jsonOptions("POST", { name: name.value }));
        } else {
          await apiFetch(`/groups/${id}`, jsonOptions("PATCH", { name: name.value }));
        }
        dialog.close();
        await loadItems();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    document.body.append(dialog); dialog.showModal(); name.focus();
  }
})();
