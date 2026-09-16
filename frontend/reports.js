"use strict";

// Reports (Reports -> Reports) read+export, 2026-09-16 plan. Entirely
// read-only -- exporting a CSV never mutates device state. Filter
// widgets are built dynamically from GET /reports/:id/filters: a
// "time" field is rendered as a simple "last N days" number input
// (reconstructing the device's own `{"type":"day","interval":N,"finish":0}`
// JSON string on submit); every other filter is a plain text input
// taking the device's own raw override-string convention directly.

(() => {
  const tab = document.getElementById("tab-reports");
  const refresh = element("button", "Refresh");
  refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(refresh); tab.append(actions);

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Name", "Export"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  let listVersion = 0;
  async function loadItems() {
    const version = ++listVersion;
    const data = await apiFetch("/reports");
    if (version !== listVersion) return;
    const items = data.reports;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      row.append(element("td", item.name));
      const exportCell = element("td");
      actionButton(exportCell, "Export", () => openExportModal(item));
      row.append(exportCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} reports` : "No reports found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "reports") runAction(refresh, loadItems);
  });

  function timeFilterInterval(value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && parsed.type === "day" && Number.isFinite(parsed.interval)) return parsed.interval;
    } catch { /* fall through */ }
    return 29;
  }

  async function openExportModal(report) {
    if (document.querySelector("dialog[open]")) return;
    const filters = (await apiFetch(`/reports/${report.id}/filters`)).filters.filter(f => f.visible);

    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", `Export — ${report.name}`);
    title.id = "export-report-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";

    const form = element("form", undefined, "general-form");
    const fields = filters.map(filter => {
      if (filter.field === "time") {
        const field = input(form, "Last N days (leave as-is for the device default)", "number");
        field.min = "1"; field.value = String(timeFilterInterval(filter.value));
        return { filter, field, isTime: true };
      }
      const field = input(form, `${filter.object}.${filter.field}`);
      field.required = false;  // an empty value means "no filter applied" (device default)
      field.value = filter.value;
      return { filter, field, isTime: false };
    });

    const save = element("button", "Export"); save.type = "submit"; form.append(save);
    dialog.append(form);

    form.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        const overrides = {};
        fields.forEach(({ filter, field, isTime }) => {
          overrides[filter.id] = isTime
            ? JSON.stringify({ type: "day", interval: Number(field.value) || 1, finish: 0 })
            : field.value;
        });
        const response = await fetch(`/reports/${report.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: overrides }),
        });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`${errorBody.type ? errorBody.type + ": " : ""}${errorBody.error || `Export failed (HTTP ${response.status}).`}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = `${report.name}.csv`;
        document.body.append(link); link.click(); link.remove();
        URL.revokeObjectURL(url);
        dialog.close();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    document.body.append(dialog); dialog.showModal();
  }
})();
