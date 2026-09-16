"use strict";

// Relay / Door actions (2026-09-16 plan). Unlike every prior write
// this project has shipped, clicking one of these buttons has an
// immediate real-world physical effect (unlocks a real door/relay),
// not just a database mutation -- fires immediately on click, no
// per-attempt confirmation dialog (feedback_write_api_risk_tiers.md
// explicitly says relay/turnstile writes don't need one, matching the
// real device's own sidebar behavior).

(() => {
  const tab = document.getElementById("tab-relay-actions");
  const refresh = element("button", "Refresh"); refresh.type = "button";
  const actions = element("div", undefined, "actions"); actions.append(refresh); tab.append(actions);

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Action", "Trigger"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  async function load() {
    const data = await apiFetch("/relay-actions");
    const items = data.actions;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      row.append(element("td", item.label));
      const triggerCell = element("td");
      const triggerButton = element("button", "Trigger"); triggerButton.type = "button";
      triggerButton.addEventListener("click", () => runAction(triggerButton, async () => {
        await apiFetch(`/relay-actions/${item.id}/trigger`, jsonOptions("POST", {}, { "X-Confirm-Sensitive-Action": "yes" }));
        await load();
      }));
      triggerCell.append(triggerButton); row.append(triggerCell);
      body.append(row);
    });
    status.textContent = items.length ? `${items.length} actions` : "No relay/door actions currently active.";
  }

  refresh.addEventListener("click", () => runAction(refresh, load));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "relay-actions") runAction(refresh, load);
  });
})();
