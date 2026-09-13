"use strict";

(() => {
  const tab = document.getElementById("tab-access-logs");
  const form = element("form");
  const fields = {};
  ["from", "to", "limit"].forEach(key => {
    const label = element("label", key === "limit" ? "Limit" : `${key === "from" ? "From" : "To"} (local time)`);
    const field = element("input");
    field.type = key === "limit" ? "number" : "datetime-local";
    field.name = key;
    field.step = "1";
    if (key === "limit") { field.min = "1"; field.max = "2147483647"; }
    label.append(field); form.append(label); fields[key] = field;
  });
  const filter = element("button", "Filter"); filter.type = "submit"; form.append(filter); tab.append(form);
  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead"); const row = element("tr");
  const columns = ["id", "time", "userId", "portalId", "logTypeId", "event"];
  columns.forEach(key => { const th = element("th", key); th.scope = "col"; row.append(th); });
  head.append(row); const body = element("tbody"); table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  async function load() {
    if (!form.reportValidity()) return;
    const query = new URLSearchParams();
    for (const key of ["from", "to"]) {
      if (!fields[key].value) continue;
      const seconds = Math.floor(new Date(fields[key].value).getTime() / 1000);
      if (!Number.isFinite(seconds)) throw new Error("Enter a valid filter date and time.");
      query.set(key, String(seconds));
    }
    if (query.has("from") && query.has("to") && Number(query.get("from")) > Number(query.get("to"))) {
      throw new Error("From must be earlier than or equal to To.");
    }
    if (fields.limit.value) query.set("limit", fields.limit.value);
    const logs = await apiFetch(`/access-logs${query.size ? "?" + query.toString() : ""}`);
    body.replaceChildren();
    logs.forEach(log => {
      const tr = element("tr");
      columns.forEach(key => tr.append(element("td", key === "time" ? formatTime(log[key]) : log[key])));
      body.append(tr);
    });
    status.textContent = logs.length ? `${logs.length} access logs` : "No access logs found.";
  }
  form.addEventListener("submit", event => { event.preventDefault(); runAction(filter, load); });
  document.addEventListener("tab-activated", event => {
    if (event.detail === "access-logs") runAction(filter, load);
  });
})();
