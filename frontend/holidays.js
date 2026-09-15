"use strict";

// Holidays (Enroll -> Holidays) write side, 2026-09-15 plan. No
// protected-id record exists for this object (spec.md Background: no
// `noSave` in class.js), unlike Groups/Time Zones -- every row gets
// full Edit/Remove. `end` has no form control at all: the SDK/backend
// always compute it as start + 86399 (spec.md Decision 1), so this
// page never sends or displays it as an editable field.
const HOLIDAY_CATEGORY_FIELDS = [["hol1", "Type 1"], ["hol2", "Type 2"], ["hol3", "Type 3"]];

// epoch seconds (UTC midnight, matching the live-captured create
// payload's own convention) <-> the plain date string a native
// <input type="date"> reads/writes.
function toDateValue(epochSeconds) {
  if (!epochSeconds) return "";
  const d = new Date(epochSeconds * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function fromDateValue(value) {
  if (!value) throw new Error("Enter a valid date.");
  const seconds = Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000);
  if (!Number.isFinite(seconds)) throw new Error("Enter a valid date.");
  return seconds;
}

(() => {
  const tab = document.getElementById("tab-holidays");
  const refresh = element("button", "Refresh");
  const add = element("button", "Add Holiday", "success");
  add.type = refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(add, refresh); tab.append(actions);
  add.addEventListener("click", () => runAction(add, () => openHolidayModal(null)));

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Name", "Date", "Type 1", "Type 2", "Type 3", "Repeats", "Edit", "Remove"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  let listVersion = 0;
  async function loadItems() {
    const version = ++listVersion;
    const data = await apiFetch("/holidays");
    if (version !== listVersion) return;
    const items = data.holidays;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      row.append(element("td", item.name));
      row.append(element("td", toDateValue(item.start)));
      const boolCell = (value, yesLabel, noLabel) => { const td = element("td"); td.append(booleanIcon(value, yesLabel, noLabel)); return td; };
      row.append(
        boolCell(item.hol1, "Type 1", "Not type 1"),
        boolCell(item.hol2, "Type 2", "Not type 2"),
        boolCell(item.hol3, "Type 3", "Not type 3"),
        boolCell(item.repeats, "Repeats yearly", "Does not repeat"),
      );
      const editCell = element("td"); actionButton(editCell, "Edit", () => openHolidayModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      actionButton(removeCell, "Remove", async () => {
        if (!window.confirm(`Remove holiday "${item.name}"? This permanently deletes it and cannot be undone.`)) return;
        await apiFetch(`/holidays/${item.id}`, { method: "DELETE" });
        await loadItems();
      }, true);
      row.append(removeCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} holidays` : "No holidays found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "holidays") runAction(refresh, loadItems);
  });

  async function openHolidayModal(id) {
    let item = id === null
      ? { name: "", start: 0, hol1: true, hol2: true, hol3: true, repeats: true }
      : (await apiFetch("/holidays")).holidays.find(h => h.id === id);
    if (document.querySelector("dialog[open]")) return;
    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", id === null ? "Add Holiday" : `Edit Holiday — ${item.name}`);
    title.id = "edit-holiday-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";

    const form = element("form", undefined, "general-form");
    const name = input(form, "Name"); name.value = item.name;
    const date = input(form, "Date", "date"); date.value = toDateValue(item.start) || toDateValue(Math.floor(Date.now() / 1000));

    const categoryRow = element("div", undefined, "actions");
    const categoryChecks = HOLIDAY_CATEGORY_FIELDS.map(([key, label]) => {
      const wrapLabel = element("label", label, "check");
      const box = element("input"); box.type = "checkbox"; box.checked = item[key];
      wrapLabel.prepend(box); categoryRow.append(wrapLabel);
      return { key, box };
    });
    form.append(categoryRow);

    const repeatsLabel = element("label", "Repeats yearly", "check");
    const repeatsBox = element("input"); repeatsBox.type = "checkbox"; repeatsBox.checked = item.repeats;
    repeatsLabel.prepend(repeatsBox); form.append(repeatsLabel);

    const save = element("button", "Save"); save.type = "submit"; form.append(save);
    dialog.append(form);

    form.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        const payload = {
          name: name.value,
          start: fromDateValue(date.value),
          ...Object.fromEntries(categoryChecks.map(({ key, box }) => [key, box.checked])),
          repeats: repeatsBox.checked,
        };
        if (id === null) {
          await apiFetch("/holidays", jsonOptions("POST", payload));
        } else {
          await apiFetch(`/holidays/${id}`, jsonOptions("PATCH", payload));
        }
        dialog.close();
        await loadItems();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    document.body.append(dialog); dialog.showModal(); name.focus();
  }
})();
