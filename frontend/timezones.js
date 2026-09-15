"use strict";

// Time Zones (Enroll -> Time Zones) write side, 2026-09-15 plan.
// A time zone owns a set of "time spans" (day-of-week/time-of-day/
// holiday rules) -- not a tabbed modal like Users/Visits, just a
// General section (Name) plus a Time Spans sub-section, locked until
// first save (same convention as Users/Visits' Cards tab). The real
// device's own UI disables editing/removing whichever time zone has
// id 1 on this device (a protected default, "Always Allowed" --
// `noSave:[1]` in the device's own class.js), same pattern already
// handled for Groups; see
// .plans/2026-09-15-timezones-write-side/spec.md Decision 3.
// Reuses the file-scope input()/actionButton() helpers users.js
// already exports (script load order: users.js before timezones.js).
const PROTECTED_TIMEZONE_ID = 1;
const DAY_FIELDS = [["sun", "Sun"], ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"]];
const HOLIDAY_FIELDS = [["hol1", "Holiday 1"], ["hol2", "Holiday 2"], ["hol3", "Holiday 3"]];

function secondsToTimeValue(seconds) {
  const s = Math.max(0, Math.min(86399, Math.floor(seconds)));
  const pad = n => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
function timeValueToSeconds(value) {
  const parts = value.split(":").map(Number);
  const [h, m, s] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  return h * 3600 + m * 60 + s;
}

(() => {
  const tab = document.getElementById("tab-timezones");
  const refresh = element("button", "Refresh");
  const add = element("button", "Add Time Zone", "success");
  add.type = refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(add, refresh); tab.append(actions);
  add.addEventListener("click", () => runAction(add, () => openTimeZoneModal(null)));

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
    const data = await apiFetch("/timezones");
    if (version !== listVersion) return;
    const items = data.timezones;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      row.append(element("td", item.name));
      const editCell = element("td"); actionButton(editCell, "Edit", () => openTimeZoneModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      if (item.id !== PROTECTED_TIMEZONE_ID) {
        actionButton(removeCell, "Remove", async () => {
          if (!window.confirm(`Remove time zone "${item.name}"? This permanently deletes it and all its time spans, and cannot be undone.`)) return;
          await apiFetch(`/timezones/${item.id}`, { method: "DELETE" });
          await loadItems();
        }, true);
      }
      row.append(removeCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} time zones` : "No time zones found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "timezones") runAction(refresh, loadItems);
  });

  function spanForm(parent) {
    const form = element("form", undefined, "general-form");
    const startInput = input(form, "Start Time", "time"); startInput.step = "1"; startInput.value = "00:00:00";
    const endInput = input(form, "End Time", "time"); endInput.step = "1"; endInput.value = "23:59:59";
    const daysRow = element("div", undefined, "actions");
    const dayChecks = DAY_FIELDS.map(([key, label]) => {
      const wrapLabel = element("label", label, "check");
      const box = element("input"); box.type = "checkbox"; box.checked = true;
      wrapLabel.prepend(box); daysRow.append(wrapLabel);
      return { key, box };
    });
    form.append(daysRow);
    const holidaysRow = element("div", undefined, "actions");
    const holidayChecks = HOLIDAY_FIELDS.map(([key, label]) => {
      const wrapLabel = element("label", label, "check");
      const box = element("input"); box.type = "checkbox"; box.checked = true;
      wrapLabel.prepend(box); holidaysRow.append(wrapLabel);
      return { key, box };
    });
    form.append(holidaysRow);
    const submit = element("button", "Add Time Span"); submit.type = "submit"; form.append(submit);
    const cancelEdit = element("button", "Cancel Edit"); cancelEdit.type = "button"; cancelEdit.hidden = true; form.append(cancelEdit);
    parent.append(form);
    let editingId = null;
    function reset() {
      editingId = null;
      form.reset();
      dayChecks.forEach(({ box }) => { box.checked = true; });
      holidayChecks.forEach(({ box }) => { box.checked = true; });
      startInput.value = "00:00:00"; endInput.value = "23:59:59";
      submit.textContent = "Add Time Span";
      cancelEdit.hidden = true;
    }
    cancelEdit.addEventListener("click", reset);
    return {
      form, submit,
      get editingId() { return editingId; },
      readValues() {
        const values = { start: timeValueToSeconds(startInput.value), end: timeValueToSeconds(endInput.value) };
        dayChecks.forEach(({ key, box }) => { values[key] = box.checked; });
        holidayChecks.forEach(({ key, box }) => { values[key] = box.checked; });
        return values;
      },
      startEditing(span) {
        editingId = span.id;
        startInput.value = secondsToTimeValue(span.start);
        endInput.value = secondsToTimeValue(span.end);
        dayChecks.forEach(({ key, box }) => { box.checked = span[key]; });
        holidayChecks.forEach(({ key, box }) => { box.checked = span[key]; });
        submit.textContent = "Save Time Span";
        cancelEdit.hidden = false;
      },
      reset,
    };
  }

  async function openTimeZoneModal(id) {
    let item = id === null ? { name: "" } : (await apiFetch("/timezones")).timezones.find(z => z.id === id);
    if (document.querySelector("dialog[open]")) return;
    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", id === null ? "Add Time Zone" : `Edit Time Zone — ${item.name}`);
    title.id = "edit-timezone-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";

    const generalForm = element("form", undefined, "general-form");
    const name = input(generalForm, "Name"); name.value = item.name;
    const protectedZone = id === PROTECTED_TIMEZONE_ID;
    name.disabled = protectedZone;
    const save = element("button", "Save"); save.type = "submit"; save.disabled = protectedZone; generalForm.append(save);
    if (protectedZone) {
      generalForm.append(element("p", "This is a protected default time zone and cannot be renamed.", "lock-note"));
    }
    dialog.append(generalForm);

    const spansSection = element("fieldset");
    spansSection.append(element("legend", "Time Spans"));
    spansSection.disabled = id === null;
    const spanList = element("ul"); spansSection.append(spanList);
    // Only build the Add-span form once the zone actually exists (id
    // !== null) -- otherwise both this initial build AND the
    // post-first-save rebuild below would run, appending two forms.
    let spanFormHandle = null;
    if (!protectedZone && id !== null) {
      spanFormHandle = spanForm(spansSection);
    }
    dialog.append(spansSection);
    const lockNote = element("p", "(*) Save the time zone to enable editing of Time Spans", "lock-note");
    lockNote.hidden = id !== null;
    dialog.append(lockNote);

    async function refreshSpans() {
      if (id === null) return;
      const data = await apiFetch(`/timezones/${id}/spans`);
      spanList.replaceChildren();
      data.spans.forEach(span => {
        const days = DAY_FIELDS.filter(([key]) => span[key]).map(([, label]) => label).join(",") || "none";
        const hols = HOLIDAY_FIELDS.filter(([key]) => span[key]).map(([, label]) => label).join(",") || "none";
        const li = element("li", `${secondsToTimeValue(span.start)}–${secondsToTimeValue(span.end)} · Days: ${days} · Holidays: ${hols}`);
        if (!protectedZone) {
          actionButton(li, "Edit", () => spanFormHandle.startEditing(span));
          actionButton(li, "Remove", async () => {
            await apiFetch(`/timespans/${span.id}`, { method: "DELETE" });
            await refreshSpans();
          }, true);
        }
        spanList.append(li);
      });
    }

    function wireSpanForm() {
      spanFormHandle.form.addEventListener("submit", event => {
        event.preventDefault();
        runAction(spanFormHandle.submit, async () => {
          const editingId = spanFormHandle.editingId;
          if (editingId === null) {
            await apiFetch(`/timezones/${id}/spans`, jsonOptions("POST", spanFormHandle.readValues()));
          } else {
            await apiFetch(`/timespans/${editingId}`, jsonOptions("PATCH", spanFormHandle.readValues()));
          }
          spanFormHandle.reset();
          await refreshSpans();
        });
      });
    }
    if (spanFormHandle) wireSpanForm();

    generalForm.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        if (id === null) {
          const result = await apiFetch("/timezones", jsonOptions("POST", { name: name.value }));
          id = result.id;
          item = { ...item, name: name.value, id };
          title.textContent = `Edit Time Zone — ${item.name}`;
          spansSection.disabled = false;
          spanFormHandle = spanForm(spansSection);
          wireSpanForm();
          lockNote.hidden = true;
          await refreshSpans();
          await loadItems();
          return;
        }
        if (name.value !== item.name) {
          await apiFetch(`/timezones/${id}`, jsonOptions("PATCH", { name: name.value }));
        }
        await loadItems();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    if (id !== null) refreshSpans();
    document.body.append(dialog); dialog.showModal(); name.focus();
  }
})();
