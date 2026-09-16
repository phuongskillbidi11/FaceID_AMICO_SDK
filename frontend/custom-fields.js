"use strict";

// Custom Fields (Enroll -> Custom Fields) write side, 2026-09-16 plan.
// Adds a column to an existing table (Users/Visitors/Visits) --
// structurally distinct from User Types, which creates a whole new
// table. The list only ever shows Table/Name: `type`/`mandatory` are
// device-confirmed write-only (custom_columns has no such column at
// all -- spec.md Decision 2), so this page cannot display them after
// creation, and the Edit modal only ever offers renaming.
const CUSTOM_FIELD_TABLES = ["Users", "Visitors", "Visits"];
const CUSTOM_FIELD_TYPES = ["Text", "Number"];

(() => {
  const tab = document.getElementById("tab-custom-fields");
  const refresh = element("button", "Refresh");
  const add = element("button", "Add Custom Field", "success");
  add.type = refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(add, refresh); tab.append(actions);
  add.addEventListener("click", () => runAction(add, () => openCustomFieldModal(null)));

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Table", "Name", "Edit", "Remove"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  let listVersion = 0;
  async function loadItems() {
    const version = ++listVersion;
    const data = await apiFetch("/custom-fields");
    if (version !== listVersion) return;
    const items = data.customFields;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      row.append(element("td", item.table));
      row.append(element("td", item.name));
      const editCell = element("td"); actionButton(editCell, "Edit", () => openCustomFieldModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      actionButton(removeCell, "Remove", async () => {
        if (!window.confirm(`Remove custom field "${item.name}"? This permanently deletes it, including its underlying data column, and cannot be undone.`)) return;
        await apiFetch(`/custom-fields/${item.id}`, { method: "DELETE" });
        await loadItems();
      }, true);
      row.append(removeCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} custom fields` : "No custom fields found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "custom-fields") runAction(refresh, loadItems);
  });

  function selectField(parent, title, options) {
    const label = element("label", title);
    const field = element("select");
    field.required = true;
    options.forEach(value => {
      const option = element("option", value); option.value = value;
      field.append(option);
    });
    label.append(field);
    parent.append(label);
    return field;
  }

  // `id` is null for Add. Edit re-fetches the list to find the row
  // (matching every other page's convention) but never has
  // Type/Mandatory to show back, since neither is readable through
  // this device's own API (spec.md Decision 2).
  async function openCustomFieldModal(id) {
    const item = id === null
      ? null
      : (await apiFetch("/custom-fields")).customFields.find(f => f.id === id);
    if (document.querySelector("dialog[open]")) return;
    const isEdit = item !== null;
    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", isEdit ? `Edit Custom Field — ${item.name}` : "Add Custom Field");
    title.id = "edit-custom-field-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";

    const form = element("form", undefined, "general-form");
    let tableField, typeField, mandatoryBox;
    if (isEdit) {
      form.append(element("p", `Table: ${item.table}`));
    } else {
      tableField = selectField(form, "Table", CUSTOM_FIELD_TABLES);
      typeField = selectField(form, "Type", CUSTOM_FIELD_TYPES);
    }
    const name = input(form, "Name"); name.value = isEdit ? item.name : "";
    if (!isEdit) {
      const mandatoryLabel = element("label", "Mandatory", "check");
      mandatoryBox = element("input"); mandatoryBox.type = "checkbox";
      mandatoryLabel.prepend(mandatoryBox); form.append(mandatoryLabel);
    }

    const save = element("button", "Save"); save.type = "submit"; form.append(save);
    dialog.append(form);

    form.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        if (isEdit) {
          await apiFetch(`/custom-fields/${item.id}`, jsonOptions("PATCH", { name: name.value }));
        } else {
          await apiFetch("/custom-fields", jsonOptions("POST", {
            table: tableField.value, type: typeField.value,
            name: name.value, mandatory: mandatoryBox.checked,
          }));
        }
        dialog.close();
        await loadItems();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    document.body.append(dialog); dialog.showModal(); name.focus();
  }
})();
