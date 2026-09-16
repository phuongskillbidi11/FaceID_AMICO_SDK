"use strict";

(() => {
  const tab = document.getElementById("tab-system-info");
  const refresh = element("button", "Refresh"); refresh.type = "button";
  const actions = element("div", undefined, "actions"); actions.append(refresh); tab.append(actions);
  const list = element("dl", undefined, "system-details"); tab.append(list);

  // Date and Time settings (Date and Time settings plan, 2026-09-16)
  // -- read-only, shares the same generic dl renderer below rather
  // than a new sidebar section (spec.md's own Simplicity First call).
  tab.append(element("h3", "Date and Time"));
  const dateTimeList = element("dl", undefined, "system-details"); tab.append(dateTimeList);

  function render(list, value, path) {
    if (value !== null && typeof value === "object" && Object.keys(value).length) {
      Object.entries(value).forEach(([key, child]) => render(list, child, path ? `${path}.${key}` : key));
    } else {
      list.append(element("dt", path), element("dd", value !== null && typeof value === "object" ? JSON.stringify(value) : value));
    }
  }

  async function load() {
    const info = await apiFetch("/system-information");
    list.replaceChildren();
    Object.entries(info).forEach(([key, value]) => render(list, value, key));

    const dateTime = await apiFetch("/settings/date-time");
    dateTimeList.replaceChildren();
    Object.entries(dateTime).forEach(([key, value]) => render(dateTimeList, value, key));
  }
  refresh.addEventListener("click", () => runAction(refresh, load));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "system-info") runAction(refresh, load);
  });
})();
