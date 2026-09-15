"use strict";

// Visits (Enroll -> Visits), 2026-09-14 plan. Deliberately NOT built on
// initUserListPage() -- the `visits` object has its own PK/fields, a
// materially different modal (Visitor/Host pickers instead of Name/
// Employee ID, no photo/PIN/Administrator, a dedicated Finish action
// with a real device-side side effect) -- see
// .plans/2026-09-14-implement-visits-enroll-visits-crud/spec.md
// Decision 5. Reuses the file-scope input()/actionButton()/
// renderCardsSubform() helpers users.js already exports (script load
// order: users.js before visits.js, see index.html).

(() => {
  const tab = document.getElementById("tab-visits");
  const refresh = element("button", "Refresh");
  const add = element("button", "Add Visit", "success");
  add.type = refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(add, refresh); tab.append(actions);
  add.addEventListener("click", () => runAction(add, () => openVisitModal(null)));

  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Visitor", "Host", "Start Date", "Start Time", "End Date", "End Time", "Nº of Cards", "Concluded", "Finish", "Edit", "Remove"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);

  const sessionCards = new Map();
  let listVersion = 0;
  // Shared across every modal opened from this tab in this page session,
  // same rationale as users.js's loadAllGroups().
  let visitorsPromise, hostsPromise;
  function loadVisitors() {
    if (!visitorsPromise) {
      visitorsPromise = apiFetch("/visitors?limit=100000")
        .catch(error => { visitorsPromise = undefined; throw error; });
    }
    return visitorsPromise;
  }
  function loadHosts() {
    if (!hostsPromise) {
      hostsPromise = apiFetch("/users?limit=100000")
        .catch(error => { hostsPromise = undefined; throw error; });
    }
    return hostsPromise;
  }

  function formatDate(epochSeconds) {
    if (!epochSeconds) return "—";
    return new Date(epochSeconds * 1000).toLocaleDateString();
  }
  function formatClock(epochSeconds) {
    if (!epochSeconds) return "—";
    return new Date(epochSeconds * 1000).toLocaleTimeString();
  }

  function select(parent, title) {
    const label = element("label", title);
    const field = element("select");
    field.required = true;
    label.append(field);
    parent.append(label);
    return field;
  }

  async function loadItems() {
    const version = ++listVersion;
    const items = await apiFetch("/visits");
    if (version !== listVersion) return;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      [item.visitorName, item.hostName, formatDate(item.beginTime), formatClock(item.beginTime),
       formatDate(item.endTime), formatClock(item.endTime), item.cardCount].forEach(value => row.append(element("td", value)));
      const concluded = element("td"); concluded.append(booleanIcon(item.finished, "Yes", "No")); row.append(concluded);
      const finishCell = element("td");
      if (!item.finished) {
        actionButton(finishCell, "Finish", async () => {
          if (!window.confirm(`Finish this visit for ${item.visitorName}? This revokes every card currently issued to ${item.visitorName} and cannot be undone.`)) return;
          await apiFetch(`/visits/${item.id}/finish`, { method: "POST" });
          await loadItems();
        });
      }
      row.append(finishCell);
      const editCell = element("td"); actionButton(editCell, "Edit", () => openVisitModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      actionButton(removeCell, "Remove", async () => {
        if (!window.confirm(`Remove this visit for ${item.visitorName}? This permanently deletes the visit and cannot be undone. It does NOT revoke any cards already issued to ${item.visitorName} -- use Finish for that.`)) return;
        await apiFetch(`/visits/${item.id}`, { method: "DELETE" });
        sessionCards.delete(item.visitorId);
        await loadItems();
      }, true);
      row.append(removeCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} visits` : "No visits found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "visits") runAction(refresh, loadItems);
  });

  async function openVisitModal(existingId) {
    let id = existingId;
    let item = id === null
      ? { visitorId: null, hostId: null, visitorName: "", hostName: "", beginTime: 0, endTime: 0, finished: false, cardCount: 0 }
      : await apiFetch(`/visits/${id}`);
    if (document.querySelector("dialog[open]")) return;
    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", id === null ? "Add Visit" : `Edit Visit — ${item.visitorName}`);
    title.id = "edit-visit-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";
    const tabsArea = element("div", undefined, "dialog-tabs-area");
    dialog.append(tabsArea);
    const tabs = element("div", undefined, "tabs");
    tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Visit details");
    tabsArea.append(tabs);
    const panels = new Map();
    const tabButtons = [];
    function selectTab(selected, focus = false) {
      if (selected.disabled) return;
      tabButtons.forEach(button => {
        const active = button === selected;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
        panels.get(button.textContent).hidden = !active;
      });
      if (focus) selected.focus();
    }
    ["General", "Cards"].forEach((label, index) => {
      const button = element("button", label, "tab-button");
      button.type = "button"; button.id = `visit-tab-${index}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `visit-panel-${index}`);
      button.setAttribute("aria-selected", String(index === 0));
      button.tabIndex = index === 0 ? 0 : -1;
      button.disabled = index !== 0 && id === null;
      const panel = element("div", undefined, "tab-panel");
      panel.id = `visit-panel-${index}`; panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id); panel.tabIndex = 0;
      panel.hidden = index !== 0;
      panels.set(label, panel); tabButtons.push(button);
      button.addEventListener("click", () => selectTab(button));
      tabs.append(button); tabsArea.append(panel);
    });
    tabs.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const enabled = tabButtons.filter(button => !button.disabled);
      const current = enabled.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length;
      selectTab(enabled[next], true);
    });

    const details = element("form", undefined, "general-form");
    const visitorSelect = select(details, "Visitor");
    const hostSelect = select(details, "Host");
    async function populatePickers() {
      const [visitors, hosts] = await Promise.all([loadVisitors(), loadHosts()]);
      visitorSelect.replaceChildren(...visitors.map(v => { const o = element("option", v.name); o.value = String(v.id); return o; }));
      hostSelect.replaceChildren(...hosts.map(h => { const o = element("option", h.name); o.value = String(h.id); return o; }));
      if (item.visitorId) visitorSelect.value = String(item.visitorId);
      if (item.hostId) hostSelect.value = String(item.hostId);
    }
    const startInput = input(details, "Start Date/Time", "datetime-local");
    const endInput = input(details, "End Date/Time", "datetime-local"); endInput.required = false;
    function refreshDateFields() {
      startInput.value = toDatetimeLocalValue(item.beginTime);
      endInput.value = toDatetimeLocalValue(item.endTime);
    }
    refreshDateFields();
    const save = element("button", "Save"); save.type = "submit"; details.append(save);
    const lockNote = element("p", "(*) Save the visit to enable editing of Cards", "lock-note");
    lockNote.hidden = id !== null;
    panels.get("General").append(details, lockNote);
    const saveStatus = element("p"); saveStatus.setAttribute("role", "status");
    panels.get("General").append(saveStatus);

    const cardsPanel = panels.get("Cards");
    cardsPanel.append(element("p", "Cards issued to this visit's visitor."));
    const cardsSubform = renderCardsSubform(cardsPanel, { apiPath: "/visitors", itemId: () => item.visitorId, sessionCards });
    cardsSubform.setOnChange(reload);

    async function reload() {
      item = await apiFetch(`/visits/${id}`);
      title.textContent = `Edit Visit — ${item.visitorName}`;
      refreshDateFields();
      await populatePickers();
      cardsSubform.refresh(item.cardCount);
      await loadItems();
    }

    details.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        const newBeginTime = fromDatetimeLocalValue(startInput.value);
        const newEndTime = fromDatetimeLocalValue(endInput.value);
        if (id === null) {
          const values = {
            visitorId: Number(visitorSelect.value),
            hostId: Number(hostSelect.value),
            beginTime: newBeginTime,
          };
          if (newEndTime !== null) values.endTime = newEndTime;
          const result = await apiFetch("/visits", jsonOptions("POST", values));
          id = result.id;
          item = { ...item, ...values, endTime: values.endTime || 0, id };
          title.textContent = "Edit Visit";
          tabButtons.forEach(button => { button.disabled = false; });
          lockNote.hidden = true;
          saveStatus.textContent = "Visit created. Cards tab is now available.";
          await reload();
          return;
        }
        const changes = {};
        const newVisitorId = Number(visitorSelect.value);
        if (newVisitorId !== item.visitorId) changes.visitorId = newVisitorId;
        const newHostId = Number(hostSelect.value);
        if (newHostId !== item.hostId) changes.hostId = newHostId;
        if (newBeginTime !== null && newBeginTime !== (item.beginTime || null)) changes.beginTime = newBeginTime;
        if (newEndTime !== null && newEndTime !== (item.endTime || null)) changes.endTime = newEndTime;
        if (!Object.keys(changes).length) return;
        await apiFetch(`/visits/${id}`, jsonOptions("PATCH", changes));
        saveStatus.textContent = "Visit details saved.";
        await reload();
      });
    });

    dialog.addEventListener("close", () => { dialog.remove(); });
    populatePickers();
    cardsSubform.refresh(item.cardCount);
    document.body.append(dialog); dialog.showModal(); visitorSelect.focus();
  }
})();
