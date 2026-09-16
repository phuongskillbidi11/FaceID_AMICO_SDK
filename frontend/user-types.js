"use strict";

// User Types (Enroll -> User Types) write side, 2026-09-16 plan.
// Unlike every prior object this session, creating/deleting a user
// type also creates/drops a real dynamic table on the device
// (object_add.fcgi/object_remove.fcgi) -- entirely hidden behind
// UserTypesApi; this page only ever sees a name + a boolean.

(() => {
  const tab = document.getElementById("tab-user-types");
  const refresh = element("button", "Refresh");
  const add = element("button", "Add User Type", "success");
  add.type = refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(add, refresh); tab.append(actions);
  add.addEventListener("click", () => runAction(add, () => openUserTypeModal(null)));

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["User Type", "Requires Visit", "Edit", "Remove"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  let listVersion = 0;
  async function loadItems() {
    const version = ++listVersion;
    const data = await apiFetch("/user-types");
    if (version !== listVersion) return;
    const items = data.userTypes;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      row.append(element("td", item.name));
      const requireCell = element("td");
      requireCell.append(booleanIcon(item.requireVisitor, "Requires visit", "Does not require visit"));
      row.append(requireCell);
      const editCell = element("td"); actionButton(editCell, "Edit", () => openUserTypeModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      actionButton(removeCell, "Remove", async () => {
        if (!window.confirm(`Remove user type "${item.name}"? This permanently deletes it, including its underlying data table, and cannot be undone.`)) return;
        await apiFetch(`/user-types/${item.id}`, { method: "DELETE" });
        await loadItems();
      }, true);
      row.append(removeCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} user types` : "No user types found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "user-types") runAction(refresh, loadItems);
  });

  async function openUserTypeModal(id) {
    let item = id === null
      ? { name: "", requireVisitor: false }
      : (await apiFetch("/user-types")).userTypes.find(t => t.id === id);
    if (document.querySelector("dialog[open]")) return;
    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", id === null ? "Add User Type" : `Edit User Type — ${item.name}`);
    title.id = "edit-user-type-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";

    const form = element("form", undefined, "general-form");
    const name = input(form, "User Type"); name.value = item.name;

    const requireLabel = element("label", "Requires Visit", "check");
    const requireBox = element("input"); requireBox.type = "checkbox"; requireBox.checked = item.requireVisitor;
    requireLabel.prepend(requireBox); form.append(requireLabel);

    const save = element("button", "Save"); save.type = "submit"; form.append(save);
    dialog.append(form);

    form.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        const payload = { name: name.value, requireVisitor: requireBox.checked };
        if (id === null) {
          await apiFetch("/user-types", jsonOptions("POST", payload));
        } else {
          await apiFetch(`/user-types/${id}`, jsonOptions("PATCH", payload));
        }
        dialog.close();
        await loadItems();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    document.body.append(dialog); dialog.showModal(); name.focus();
  }
})();
