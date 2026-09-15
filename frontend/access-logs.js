"use strict";

(() => {
  const tab = document.getElementById("tab-access-logs");
  const panel = element("section", undefined, "filters-panel");
  const panelTitle = element("h3", "Filters");
  panelTitle.id = "access-filters-title";
  panel.setAttribute("aria-labelledby", panelTitle.id);
  const form = element("form", undefined, "filter-form");
  const dateRow = element("div", undefined, "filter-row filter-row-datetime");
  const fields = {};
  [
    ["startDate", "Start Date", "date"],
    ["endDate", "End Date", "date"],
    ["startTime", "Start Time", "time"],
    ["endTime", "End Time", "time"],
  ].forEach(([key, title, type]) => {
    const label = element("label", title);
    const field = element("input");
    field.type = type;
    field.name = key;
    label.append(field); dateRow.append(label); fields[key] = field;
  });
  form.append(dateRow);
  const selectors = {};
  const lookupRow = element("div", undefined, "filter-row filter-row-lookup");
  const filterSources = [
    // /users defaults to a 50-row page (AmicoConfig::defaultPageSize) --
    // an explicit large limit avoids silently truncating this filter's
    // option list on a device with more than 50 users.
    ["userIds", "User", "/users?limit=100000", null],
    ["groupIds", "Group", "/groups", "groups"],
    ["timeZoneIds", "Time Zone", "/timezones", "timezones"],
  ];
  filterSources.forEach(([key, title]) => {
    const group = element("div", undefined, "filter-group");
    const header = element("div", undefined, "filter-group-header");
    const label = element("span", title);
    const count = element("span", undefined, "filter-count"); count.hidden = true;
    const clear = element("button", "Clear"); clear.type = "button"; clear.disabled = true;
    clear.setAttribute("aria-label", `Clear ${title} filter (All)`);
    header.append(label, count, clear);
    const select = element("select");
    select.name = key; select.multiple = true; select.size = 5;
    select.setAttribute("aria-describedby", "access-selection-help");
    function refreshCount() {
      const n = select.selectedOptions.length;
      count.hidden = n === 0;
      count.textContent = n ? `${n} selected` : "";
      clear.disabled = n === 0;
    }
    select.addEventListener("change", refreshCount);
    clear.addEventListener("click", () => {
      Array.from(select.options).forEach(option => { option.selected = false; });
      refreshCount();
    });
    group.append(header, select); lookupRow.append(group); selectors[key] = select;
  });
  form.append(lookupRow);
  const help = element("p", "No selection means (All). Click an option to select it; Ctrl-click (Command on Mac) to select more than one.", "selection-help");
  help.id = "access-selection-help"; form.append(help);
  const actions = element("div", undefined, "actions");
  const filter = element("button", "List"); filter.type = "submit"; actions.append(filter);
  const exportButton = element("button", "Export"); exportButton.type = "button";
  exportButton.title = "Export the current page as CSV";
  exportButton.disabled = true; actions.append(exportButton);
  const printButton = element("button", "PRINT"); printButton.type = "button";
  printButton.addEventListener("click", () => window.print()); actions.append(printButton);
  form.append(actions);
  panel.append(panelTitle, form); tab.append(panel);

  const pagination = element("div", undefined, "pagination actions");
  const pageSizeLabel = element("label", "Per page");
  const pageSizeSelect = element("select");
  [10, 20, 30].forEach(size => {
    const option = element("option", String(size));
    option.value = String(size);
    pageSizeSelect.append(option);
  });
  pageSizeSelect.value = "10";
  pageSizeLabel.append(pageSizeSelect);
  const prevButton = element("button", "Previous"); prevButton.type = "button";
  const nextButton = element("button", "Next"); nextButton.type = "button";
  pagination.append(pageSizeLabel, prevButton, nextButton);
  tab.append(pagination);

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead"); const row = element("tr");
  const columns = [
    { key: "time", label: "Date and Time (Access Logs)" },
    { key: "authorizationLabel", label: "Authorization (Access Logs)" },
    { key: "identificationLabel", label: "Identification (Access Logs)" },
    { key: "userId", label: "Id (User)" },
    { key: "userName", label: "Name (User)" },
    { key: "employeeId", label: "Employee ID (User)" },
    { key: "portalName", label: "Name (Portal)" },
    { key: "timeZoneName", label: "Name (Time Zone)" },
  ];
  columns.forEach(({ label }) => { const th = element("th", label); th.scope = "col"; row.append(th); });
  head.append(row); const body = element("tbody"); table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  let offset = 0;
  let lastCount = 0;
  let lastTotal = 0;
  let optionsLoad;
  let currentEntries = [];

  function formatValue(log, key) {
    if (key === "time") return formatTime(log[key]);
    if (key === "authorizationLabel") {
      const state = authorizationState(log[key]);
      return state === true ? "Granted" : state === false ? "Not authorized" : "Not recognized";
    }
    return log[key] == null ? "—" : String(log[key]);
  }

  exportButton.addEventListener("click", () => {
    const quote = value => `"${value.replace(/"/g, '""')}"`;
    const rows = [columns.map(column => column.label),
      ...currentEntries.map(log => columns.map(({ key }) => formatValue(log, key)))];
    const csv = rows.map(row => row.map(quote).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = element("a"); link.href = url;
    link.download = `access-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function loadOptions() {
    if (!optionsLoad) {
      optionsLoad = Promise.all(filterSources.map(async ([key, , path, property]) => {
        const data = await apiFetch(path);
        return [key, property ? data[property] : data];
      })).then(results => {
        results.forEach(([key, items]) => {
          selectors[key].replaceChildren(...items.map(item => {
            const option = element("option", item.name || String(item.id));
            option.value = String(item.id); return option;
          }));
        });
      }).catch(error => { optionsLoad = undefined; throw error; });
    }
    return optionsLoad;
  }

  function updatePaginationControls() {
    prevButton.disabled = offset <= 0;
    nextButton.disabled = offset + lastCount >= lastTotal;
  }

  // "Granted" -> true (green check); "Not authorized" -> false (red X);
  // anything else (i.e. "Not recognized") -> null (grey X) -- matches the
  // real device's own report.js checkBoolean() tri-state icon exactly.
  function authorizationState(label) {
    if (label === "Granted") return true;
    if (label === "Not authorized") return false;
    return null;
  }

  function combineDateAndTime(dateValue, timeValue, fallbackTime) {
    if (!dateValue) return null;
    const seconds = Math.floor(new Date(`${dateValue}T${timeValue || fallbackTime}:00`).getTime() / 1000);
    if (!Number.isFinite(seconds)) throw new Error("Enter a valid filter date and time.");
    return seconds;
  }

  async function load() {
    if (!form.reportValidity()) return;
    const query = new URLSearchParams();
    const from = combineDateAndTime(fields.startDate.value, fields.startTime.value, "00:00");
    const to = combineDateAndTime(fields.endDate.value, fields.endTime.value, "23:59");
    if (from !== null) query.set("from", String(from));
    if (to !== null) query.set("to", String(to));
    if (from !== null && to !== null && from > to) {
      throw new Error("Start must be earlier than or equal to End.");
    }
    query.set("limit", pageSizeSelect.value);
    query.set("offset", String(offset));
    Object.entries(selectors).forEach(([key, select]) => {
      const ids = Array.from(select.selectedOptions, option => option.value);
      if (ids.length) query.set(key, ids.join(","));
    });
    const { entries, total } = await apiFetch(`/access-logs?${query.toString()}`);
    currentEntries = entries;
    exportButton.disabled = false;
    lastCount = entries.length;
    lastTotal = total;
    body.replaceChildren();
    entries.forEach(log => {
      const tr = element("tr");
      columns.forEach(({ key }) => {
        const td = element("td");
        if (key === "authorizationLabel") td.append(booleanIcon(authorizationState(formatValue(log, key)), "Granted", "Not authorized", "Not recognized"));
        else td.textContent = formatValue(log, key);
        tr.append(td);
      });
      body.append(tr);
    });
    status.textContent = total
      ? `Showing ${offset + 1} to ${offset + entries.length} of ${total} records`
      : "No access logs found.";
    updatePaginationControls();
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    offset = 0;
    runAction(filter, load);
  });
  pageSizeSelect.addEventListener("change", () => {
    offset = 0;
    runAction(pageSizeSelect, load);
  });
  prevButton.addEventListener("click", () => {
    offset = Math.max(0, offset - Number(pageSizeSelect.value));
    runAction(prevButton, load);
  });
  nextButton.addEventListener("click", () => {
    offset += lastCount;
    runAction(nextButton, load);
  });
  document.addEventListener("tab-activated", event => {
    if (event.detail === "access-logs") runAction(filter, async () => {
      await loadOptions();
      await load();
    });
  });
})();
