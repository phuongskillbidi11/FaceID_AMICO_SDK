"use strict";

(() => {
  const tab = document.getElementById("tab-system-info");
  const refresh = element("button", "Refresh"); refresh.type = "button";
  const actions = element("div", undefined, "actions"); actions.append(refresh); tab.append(actions);
  const list = element("dl", undefined, "system-details"); tab.append(list);
  async function load() {
    const info = await apiFetch("/system-information");
    list.replaceChildren();
    function render(value, path) {
      if (value !== null && typeof value === "object" && Object.keys(value).length) {
        Object.entries(value).forEach(([key, child]) => render(child, path ? `${path}.${key}` : key));
      } else {
        list.append(element("dt", path), element("dd", value !== null && typeof value === "object" ? JSON.stringify(value) : value));
      }
    }
    Object.entries(info).forEach(([key, value]) => render(value, key));
  }
  refresh.addEventListener("click", () => runAction(refresh, load));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "system-info") runAction(refresh, load);
  });
})();
