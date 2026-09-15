"use strict";

// Scheduled Unlock (Enroll -> Scheduled Unlock) write side, 2026-09-15
// plan. A General section (Name, Message) plus a Time Zones
// sub-section, locked until first save (same convention as Time
// Zones' own Time Spans sub-section). No protected-id record exists
// for this object (spec.md Background: no `noSave` in class.js).
// create() never auto-links any time zone (spec.md Decision 1) --
// linking is always a separate, explicit action via
// POST/DELETE /scheduled-unlocks/:id/timezones/:timeZoneId.
// Reuses the file-scope input()/actionButton() helpers users.js
// already exports (script load order: users.js before this file).

(() => {
  const tab = document.getElementById("tab-scheduled-unlock");
  const refresh = element("button", "Refresh");
  const add = element("button", "Add Scheduled Unlock", "success");
  add.type = refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(add, refresh); tab.append(actions);
  add.addEventListener("click", () => runAction(add, () => openScheduledUnlockModal(null)));

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Name", "Message", "Nº of Time Zones", "Edit", "Remove"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  let listVersion = 0;
  async function loadItems() {
    const version = ++listVersion;
    const data = await apiFetch("/scheduled-unlocks");
    if (version !== listVersion) return;
    const items = data.scheduledUnlocks;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      row.append(element("td", item.name));
      row.append(element("td", item.message));
      row.append(element("td", item.timeZoneIds.length));
      const editCell = element("td"); actionButton(editCell, "Edit", () => openScheduledUnlockModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      actionButton(removeCell, "Remove", async () => {
        if (!window.confirm(`Remove scheduled unlock "${item.name}"? This permanently deletes it and cannot be undone.`)) return;
        await apiFetch(`/scheduled-unlocks/${item.id}`, { method: "DELETE" });
        await loadItems();
      }, true);
      row.append(removeCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} scheduled unlocks` : "No scheduled unlocks found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "scheduled-unlock") runAction(refresh, loadItems);
  });

  async function openScheduledUnlockModal(id) {
    let item = id === null ? { name: "", message: "", timeZoneIds: [] }
      : (await apiFetch("/scheduled-unlocks")).scheduledUnlocks.find(u => u.id === id);
    if (document.querySelector("dialog[open]")) return;
    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", id === null ? "Add Scheduled Unlock" : `Edit Scheduled Unlock — ${item.name}`);
    title.id = "edit-scheduled-unlock-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";

    const generalForm = element("form", undefined, "general-form");
    const name = input(generalForm, "Name"); name.value = item.name;
    const message = input(generalForm, "Message"); message.required = false; message.value = item.message;
    const save = element("button", "Save"); save.type = "submit"; generalForm.append(save);
    dialog.append(generalForm);

    const zonesSection = element("fieldset");
    zonesSection.append(element("legend", "Time Zones"));
    zonesSection.disabled = id === null;
    const zoneList = element("ul"); zonesSection.append(zoneList);
    const pickerRow = element("div", undefined, "actions");
    const picker = element("select");
    const addZone = element("button", "Add Time Zone"); addZone.type = "button";
    pickerRow.append(picker, addZone);
    zonesSection.append(pickerRow);
    dialog.append(zonesSection);
    const lockNote = element("p", "(*) Save the scheduled unlock to enable editing of Time Zones", "lock-note");
    lockNote.hidden = id !== null;
    dialog.append(lockNote);

    async function refreshZones() {
      if (id === null) return;
      const allZones = (await apiFetch("/timezones")).timezones;
      const linkedIds = new Set(item.timeZoneIds);
      zoneList.replaceChildren();
      allZones.filter(zone => linkedIds.has(zone.id)).forEach(zone => {
        const li = element("li", zone.name);
        actionButton(li, "Remove", async () => {
          await apiFetch(`/scheduled-unlocks/${id}/timezones/${zone.id}`, { method: "DELETE" });
          item.timeZoneIds = item.timeZoneIds.filter(tzId => tzId !== zone.id);
          await refreshZones();
          await loadItems();
        }, true);
        zoneList.append(li);
      });
      picker.replaceChildren();
      allZones.filter(zone => !linkedIds.has(zone.id)).forEach(zone => {
        const option = element("option", zone.name);
        option.value = zone.id;
        picker.append(option);
      });
      const hasAvailable = picker.childElementCount > 0;
      picker.disabled = addZone.disabled = !hasAvailable;
      if (!hasAvailable) picker.append(element("option", "No more time zones available"));
    }

    addZone.addEventListener("click", () => runAction(addZone, async () => {
      const timeZoneId = Number(picker.value);
      await apiFetch(`/scheduled-unlocks/${id}/timezones/${timeZoneId}`, { method: "POST" });
      item.timeZoneIds = [...item.timeZoneIds, timeZoneId];
      await refreshZones();
      await loadItems();
    }));

    generalForm.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        if (id === null) {
          const result = await apiFetch("/scheduled-unlocks", jsonOptions("POST", { name: name.value, message: message.value }));
          id = result.id;
          item = { ...item, name: name.value, message: message.value, id };
          title.textContent = `Edit Scheduled Unlock — ${item.name}`;
          zonesSection.disabled = false;
          lockNote.hidden = true;
          await refreshZones();
          await loadItems();
          return;
        }
        if (name.value !== item.name || message.value !== item.message) {
          await apiFetch(`/scheduled-unlocks/${id}`, jsonOptions("PATCH", { name: name.value, message: message.value }));
        }
        await loadItems();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    if (id !== null) refreshZones();
    document.body.append(dialog); dialog.showModal(); name.focus();
  }
})();
