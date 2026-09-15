"use strict";

// Groups (Enroll -> Groups) write side, 2026-09-15 plan, plus Time
// Zones linking added by the 2026-09-16-groups-timezones-write-side
// plan (reuses the exact access_rules/access_rule_time_zones
// mechanism already shipped for Scheduled Unlock -- see
// frontend/scheduled-unlock.js's own Time Zones section, which this
// one mirrors). Reuses the file-scope input()/actionButton() helpers
// users.js already exports (script load order: users.js before
// groups.js, see index.html). The real device's own UI disables
// editing/removing whichever group has id 1 on this device (a
// protected system default, `noSave:[1]` in the device's own
// class.js) -- this is a presentation-layer courtesy only, not a
// claim about server-side enforcement; see
// .plans/2026-09-15-groups-write-side/spec.md Decision 2. That
// `noSave` only covers the Name field and Remove action -- the real
// device's own `class.js` registration for the Time Zones tab has no
// such restriction, so this page doesn't lock it for the protected
// group either.
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
  ["Name", "Nº of Time Zones", "Edit", "Remove"].forEach(title => {
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
      row.append(element("td", item.timeZoneIds.length));
      const editCell = element("td"); actionButton(editCell, "Edit", () => openGroupModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      if (item.id !== PROTECTED_GROUP_ID) {
        actionButton(removeCell, "Remove", async () => {
          if (!window.confirm(`Remove group "${item.name}"? This permanently deletes the group and cannot be undone.`)) return;
          await apiFetch(`/groups/${item.id}`, { method: "DELETE" });
          document.dispatchEvent(new Event("groups-changed"));
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
    let item = id === null ? { name: "", timeZoneIds: [] } : (await apiFetch("/groups")).groups.find(g => g.id === id);
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
    const lockNote = element("p", "(*) Save the group to enable editing of Time Zones", "lock-note");
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
          await apiFetch(`/groups/${id}/timezones/${zone.id}`, { method: "DELETE" });
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
      await apiFetch(`/groups/${id}/timezones/${timeZoneId}`, { method: "POST" });
      item.timeZoneIds = [...item.timeZoneIds, timeZoneId];
      await refreshZones();
      await loadItems();
    }));

    form.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        if (id === null) {
          const result = await apiFetch("/groups", jsonOptions("POST", { name: name.value }));
          id = result.id;
          item = { ...item, name: name.value, id };
          title.textContent = `Edit Group — ${item.name}`;
          zonesSection.disabled = false;
          lockNote.hidden = true;
          document.dispatchEvent(new Event("groups-changed"));
          await refreshZones();
          await loadItems();
          return;
        }
        await apiFetch(`/groups/${id}`, jsonOptions("PATCH", { name: name.value }));
        document.dispatchEvent(new Event("groups-changed"));
        dialog.close();
        await loadItems();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    if (id !== null) refreshZones();
    document.body.append(dialog); dialog.showModal(); name.focus();
  }
})();
