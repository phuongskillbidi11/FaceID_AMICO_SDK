"use strict";

// Hoisted to file scope (Visits plan, 2026-09-14, Task 5.1) so both
// initUserListPage() below and frontend/visits.js's own modal can use
// them -- neither closes over anything from initUserListPage, so
// hoisting changes no behavior.
function input(parent, title, type = "text") {
  const label = element("label", title);
  const field = element("input");
  field.type = type;
  field.required = true;
  if (type === "number") { field.min = "0"; field.step = "1"; field.max = String(Number.MAX_SAFE_INTEGER); }
  label.append(field);
  parent.append(label);
  return field;
}
function actionButton(parent, title, action, danger = false) {
  const button = element("button", title, danger ? "danger" : undefined);
  button.type = "button";
  button.addEventListener("click", () => runAction(button, action));
  parent.append(button);
  return button;
}

// Cards sub-form, extracted from initUserListPage (Visits plan,
// 2026-09-14, Task 5.1) so a Visit's Cards tab can also use it, scoped
// to the visit's own visitorId instead of the item's own id (spec.md
// Decision 3) -- see frontend/visits.js. `itemId` is a getter (not a
// plain value) because Users/Visitors' own id is null until the first
// Save; `sessionCards` is a page-level Map the caller owns (this app
// has no bulk list-cards-by-user API, so only cards added this page
// session can be shown -- same limitation as before this extraction).
function renderCardsSubform(container, { apiPath, itemId, sessionCards }) {
  const countEl = element("p"); container.append(countEl);
  container.append(element("p", "Only cards added during this page session can be listed here. Existing card details are not available."));
  const cardList = element("ul"); container.append(cardList);
  const cardForm = element("form");
  const areaCode = input(cardForm, "Area code", "number"); areaCode.max = "4294967295";
  const cardNumber = input(cardForm, "Card number", "number"); cardNumber.max = "4294967295";
  const addCard = element("button", "Add card", "success"); addCard.type = "submit"; cardForm.append(addCard); container.append(cardForm);
  let onChange = async () => {};
  function renderList() {
    cardList.replaceChildren();
    (sessionCards.get(itemId()) || []).forEach(card => {
      const li = element("li", `Card ${card.cardId}: ${card.areaCode} / ${card.cardNumber}`);
      actionButton(li, "Remove", async () => {
        await apiFetch(`/cards/${card.cardId}`, { method: "DELETE" });
        sessionCards.set(itemId(), (sessionCards.get(itemId()) || []).filter(entry => entry.cardId !== card.cardId));
        renderList();
        await onChange();
      }, true);
      cardList.append(li);
    });
  }
  cardForm.addEventListener("submit", event => {
    event.preventDefault();
    runAction(addCard, async () => {
      const card = { areaCode: Number(areaCode.value), cardNumber: Number(cardNumber.value) };
      const result = await apiFetch(`${apiPath}/${itemId()}/cards`, jsonOptions("POST", card));
      sessionCards.set(itemId(), [...(sessionCards.get(itemId()) || []), { ...card, cardId: result.cardId }]);
      cardForm.reset(); renderList(); await onChange();
    });
  });
  return {
    setOnChange(fn) { onChange = fn; },
    refresh(cardCount) { countEl.textContent = `Cards on device: ${cardCount}`; renderList(); },
  };
}

// Shared table/modal factory for Users and Visitors (Visitors plan,
// 2026-09-14) -- the two pages are ~95% identical (same underlying
// `users` object, same tab/lock/photo-panel/Groups/Cards/PIN logic),
// so this one factory is called once by this file (below, unchanged
// output for Users) and once by frontend/visitors.js. Duplicating this
// logic into a second file would create a maintenance-drift risk (a
// future fix to one modal would need manually mirroring into the
// other) -- see .plans/2026-09-14-implement-visitors-enroll-visitors-list-/spec.md
// Decision 4.
function initUserListPage({
  tabId, apiPath, itemSingular, itemPlural,
  extraGeneralFields = [], showAdministrator = true,
}) {
  const tab = document.getElementById(`tab-${tabId}`);
  const refresh = element("button", "Refresh");
  const add = element("button", `Add ${itemSingular}`, "success");
  add.type = refresh.type = "button";
  const actions = element("div", undefined, "actions");
  actions.append(add, refresh); tab.append(actions);
  add.addEventListener("click", () => runAction(add, () => openItemModal(null)));
  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Image", "Id", "Name", "Employee ID", "Password", "Start Date/Time", "End Date/Time", "Nº of Groups", "Nº of Cards", "Face", "Last Access Date/Time", ...(showAdministrator ? ["Administrator"] : []), "Edit", "Remove"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);
  const sessionCards = new Map();
  let listVersion = 0;
  // Shared across every modal opened from this tab in this page session --
  // the device's own groups list rarely changes mid-session, and this
  // avoids a redundant GET /groups per Edit click.
  let allGroupsPromise;
  function loadAllGroups() {
    if (!allGroupsPromise) {
      allGroupsPromise = apiFetch("/groups").then(data => data.groups)
        .catch(error => { allGroupsPromise = undefined; throw error; });
    }
    return allGroupsPromise;
  }

  function renderPhoto(container, item, imageClass = "thumbnail") {
    const placeholder = () => container.replaceChildren(element("span", "No image", "placeholder"));
    if (item.imageUrl) {
      const image = element("img", undefined, imageClass);
      image.alt = `Photo of ${item.name}`;
      image.addEventListener("error", placeholder, { once: true });
      // `imageUrl` is a stable path (e.g. "/visitors/54/image") that never
      // changes across Remove Image / re-upload -- without a cache-busting
      // param the browser serves the old cached bytes for the *same* <img>
      // src and never re-requests, so a removed/replaced photo appears to
      // "not take" even though the device-side write succeeded (matches the
      // real device's own `?v=<value>` convention on this same endpoint).
      image.src = `${item.imageUrl}?v=${Date.now()}`;
      container.replaceChildren(image);
    } else placeholder();
  }

  async function loadItems() {
    const version = ++listVersion;
    const items = await apiFetch(apiPath);
    if (version !== listVersion) return;
    body.replaceChildren();
    items.forEach(item => {
      const row = element("tr");
      const photo = element("td");
      renderPhoto(photo, item);
      row.append(photo);
      [item.id, item.name, item.registration].forEach(value => row.append(element("td", value)));
      const password = element("td"); password.append(booleanIcon(item.hasPassword, "Set", "Not set")); row.append(password);
      [formatTime(item.beginTime), formatTime(item.endTime), item.groupCount, item.cardCount].forEach(value => row.append(element("td", value)));
      const face = element("td"); face.append(booleanIcon(item.faceCount > 0, "Enrolled", "Not enrolled")); row.append(face);
      row.append(element("td", formatTime(item.lastAccess)));
      if (showAdministrator) {
        const admin = element("td"); admin.append(booleanIcon(item.isAdministrator, "Yes", "No")); row.append(admin);
      }
      const editCell = element("td"); actionButton(editCell, "Edit", () => openItemModal(item.id)); row.append(editCell);
      const removeCell = element("td");
      actionButton(removeCell, "Remove", async () => {
        if (!window.confirm(`Remove ${item.name}? This permanently deletes the ${itemSingular.toLowerCase()} and cannot be undone.`)) return;
        await apiFetch(`${apiPath}/${item.id}`, { method: "DELETE" });
        sessionCards.delete(item.id);
        await loadItems();
      }, true);
      row.append(removeCell); body.append(row);
    });
    status.textContent = items.length ? `${items.length} ${itemPlural}` : `No ${itemPlural} found.`;
  }

  refresh.addEventListener("click", () => runAction(refresh, loadItems));
  document.addEventListener("tab-activated", event => {
    if (event.detail === tabId) runAction(refresh, loadItems);
  });
  async function openItemModal(existingId) {
    let id = existingId;
    let item = id === null
      ? { name: "", registration: "", groupIds: [], cardCount: 0, isAdministrator: false, hasPassword: false,
          ...Object.fromEntries(extraGeneralFields.map(field => [field.key, ""])) }
      : await apiFetch(`${apiPath}/${id}`);
    // Separate dialog instances keep in-flight actions attached to their item.
    if (document.querySelector("dialog[open]")) return;
    const dialog = element("dialog");
    const header = element("div", undefined, "dialog-header");
    const title = element("h2", id === null ? `Add ${itemSingular}` : `Edit ${item.name}`);
    title.id = "edit-item-title"; dialog.setAttribute("aria-labelledby", title.id);
    header.append(title);
    actionButton(header, "Close", () => dialog.close());
    dialog.append(header);
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError).className = "dismiss-dialog-error";
    const dialogBody = element("div", undefined, "dialog-body");
    const tabsArea = element("div", undefined, "dialog-tabs-area");
    const photoPanel = element("aside", undefined, "photo-panel");
    photoPanel.setAttribute("aria-label", "Face image");
    dialogBody.append(tabsArea, photoPanel); dialog.append(dialogBody);
    const tabs = element("div", undefined, "tabs");
    tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", `${itemSingular} details`);
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
    ["General", "Groups", "Cards", "PIN"].forEach((label, index) => {
      const button = element("button", label, "tab-button");
      button.type = "button"; button.id = `item-tab-${index}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `item-panel-${index}`);
      button.setAttribute("aria-selected", String(index === 0));
      button.tabIndex = index === 0 ? 0 : -1;
      button.disabled = index !== 0 && id === null;
      const panel = element("div", undefined, "tab-panel");
      panel.id = `item-panel-${index}`; panel.setAttribute("role", "tabpanel");
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
    const lockedFields = [];
    const name = input(details, "Name"); name.value = item.name;
    const registration = input(details, "Employee ID"); registration.required = false; registration.value = item.registration;
    const extraFieldInputs = extraGeneralFields.map(field => {
      const el = input(details, field.label); el.required = false; el.value = item[field.key] || "";
      return { key: field.key, el };
    });
    // Start/End: LIVE-CONFIRMED writable via PATCH (2026-09-14, see
    // include/amico/Types.hpp's UserUpdate doc comment) -- editable, but
    // only once the item actually exists (`lockedFields`, same "(*) Save
    // to enable editing" gating as Groups/Cards/PIN below): only the
    // *update* path is confirmed, not create-time, so these start
    // disabled for a brand-new item exactly like those other sections.
    const startInput = input(details, "Start Date/Time", "datetime-local"); startInput.required = false;
    const endInput = input(details, "End Date/Time", "datetime-local"); endInput.required = false;
    startInput.disabled = endInput.disabled = id === null;
    lockedFields.push(startInput, endInput);
    // Last Access: read-only -- device-reported telemetry, no write path
    // exists or is wanted for it.
    const lastAccessDisplay = input(details, "Last Access Date/Time"); lastAccessDisplay.required = false; lastAccessDisplay.readOnly = true;
    function refreshDateFields() {
      startInput.value = toDatetimeLocalValue(item.beginTime);
      endInput.value = toDatetimeLocalValue(item.endTime);
      lastAccessDisplay.value = formatTime(item.lastAccess);
    }
    refreshDateFields();
    const save = element("button", "Save"); save.type = "submit"; details.append(save);
    const lockNote = element("p", `(*) Save the ${itemSingular.toLowerCase()} to enable editing of all fields`, "lock-note");
    lockNote.hidden = id !== null;
    panels.get("General").append(details, lockNote);
    const saveStatus = element("p"); saveStatus.setAttribute("role", "status");
    panels.get("General").append(saveStatus);
    function section(label, tabLabel = label) {
      const fieldset = element("fieldset"); fieldset.append(element("legend", label));
      fieldset.disabled = id === null; lockedFields.push(fieldset);
      panels.get(tabLabel).append(fieldset); return fieldset;
    }
    function photoSection() {
      const fieldset = element("fieldset"); fieldset.append(element("legend", "Face image"));
      fieldset.disabled = id === null; lockedFields.push(fieldset);
      photoPanel.append(fieldset); return fieldset;
    }
    // Available/Linked dual-list picker -- matches the real device's own
    // Groups tab pattern (LIVE-CONFIRMED 2026-09-14, read-only inspection:
    // two listboxes labeled "Available"/"Linked", move an item between
    // them). This app moves items via explicit Add/Remove buttons instead
    // of the device's own drag/double-click gesture (same native-controls
    // preference as the Access Logs filters, spec.md Decision 7) -- each
    // click still calls the same already-existing per-group add/remove
    // endpoints immediately, matching this tab's pre-existing
    // immediate-action model (not staged until the main Save button).
    const groups = section("Groups");
    const groupsPicker = element("div", undefined, "dual-list");
    const availableCol = element("div", undefined, "dual-list-col");
    availableCol.append(element("h4", "Available"));
    const availableSelect = element("select"); availableSelect.multiple = true; availableSelect.size = 8;
    availableCol.append(availableSelect);
    const moveCol = element("div", undefined, "dual-list-moves");
    const addGroupButton = element("button", "Add →", "success"); addGroupButton.type = "button";
    const removeGroupButton = element("button", "← Remove", "danger"); removeGroupButton.type = "button";
    moveCol.append(addGroupButton, removeGroupButton);
    const linkedCol = element("div", undefined, "dual-list-col");
    linkedCol.append(element("h4", "Linked"));
    const linkedSelect = element("select"); linkedSelect.multiple = true; linkedSelect.size = 8;
    linkedCol.append(linkedSelect);
    groupsPicker.append(availableCol, moveCol, linkedCol);
    groups.append(groupsPicker);
    async function refreshGroupsPicker() {
      const all = await loadAllGroups();
      const linkedIds = new Set((item.groupIds || []).map(String));
      const optionFor = g => { const o = element("option", g.name); o.value = String(g.id); return o; };
      availableSelect.replaceChildren(...all.filter(g => !linkedIds.has(String(g.id))).map(optionFor));
      linkedSelect.replaceChildren(...all.filter(g => linkedIds.has(String(g.id))).map(optionFor));
    }
    addGroupButton.addEventListener("click", () => runAction(addGroupButton, async () => {
      const ids = Array.from(availableSelect.selectedOptions, option => option.value);
      for (const groupId of ids) await apiFetch(`${apiPath}/${id}/groups/${groupId}`, { method: "POST" });
      await reload();
    }));
    removeGroupButton.addEventListener("click", () => runAction(removeGroupButton, async () => {
      const ids = Array.from(linkedSelect.selectedOptions, option => option.value);
      for (const groupId of ids) await apiFetch(`${apiPath}/${id}/groups/${groupId}`, { method: "DELETE" });
      await reload();
    }));
    const cards = section("Cards");
    const cardsSubform = renderCardsSubform(cards, { apiPath, itemId: () => id, sessionCards });
    cardsSubform.setOnChange(reload);
    async function reload() {
      item = await apiFetch(`${apiPath}/${id}`);
      title.textContent = `Edit ${item.name}`;
      if (showAdministrator) administrator.checked = item.isAdministrator;
      pinStatus.textContent = item.hasPassword ? "PIN: Set" : "PIN: Not set";
      refreshDateFields();
      cardsSubform.refresh(item.cardCount);
      await refreshGroupsPicker();
      renderPhoto(photoPreview, item, "thumbnail photo-preview");
      await loadItems();
    }
    details.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        if (id === null) {
          const values = { name: name.value, registration: registration.value };
          extraFieldInputs.forEach(({ key, el }) => { values[key] = el.value; });
          const result = await apiFetch(apiPath, jsonOptions("POST", values));
          // Commit the identity before any follow-up read can fail. Save now
          // updates this item, and never repeats the successful create.
          id = result.id;
          item = { ...item, ...values, id };
          title.textContent = `Edit ${item.name}`;
          tabButtons.forEach(button => { button.disabled = false; });
          lockedFields.forEach(fieldset => { fieldset.disabled = false; });
          lockNote.hidden = true;
          saveStatus.textContent = `${itemSingular} created. All tabs are now available.`;
          await reload();
          return;
        }
        const changes = {};
        if (name.value !== item.name) changes.name = name.value;
        if (registration.value !== item.registration) changes.registration = registration.value;
        extraFieldInputs.forEach(({ key, el }) => {
          if (el.value !== (item[key] || "")) changes[key] = el.value;
        });
        const newBeginTime = fromDatetimeLocalValue(startInput.value);
        if (newBeginTime !== null && newBeginTime !== (item.beginTime || null)) changes.beginTime = newBeginTime;
        const newEndTime = fromDatetimeLocalValue(endInput.value);
        if (newEndTime !== null && newEndTime !== (item.endTime || null)) changes.endTime = newEndTime;
        if (!Object.keys(changes).length) return;
        await apiFetch(`${apiPath}/${id}`, jsonOptions("PATCH", changes));
        saveStatus.textContent = `${itemSingular} details saved.`;
        await reload();
      });
    });
    const photo = photoSection();
    const photoPreview = element("div", undefined, "photo-preview-container");
    photo.append(photoPreview);
    renderPhoto(photoPreview, item, "thumbnail photo-preview");
    photo.append(element("p", "Choose a clear, front-facing photo. Uploading enrolls the face recognition template."));
    const file = input(photo, "Image", "file"); file.accept = "image/*"; file.required = false;
    file.addEventListener("change", () => {
      const selected = file.files[0];
      if (!selected) return;
      runAction(file, async () => {
        try {
          const bytes = await jpegBytes(selected);
          try {
            await apiFetch(`${apiPath}/${id}/image`, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
          } catch (failure) {
            if (failure.type === "ProtocolError") {
              throw new Error(`${failure.message}\nThe device could not accept this face image. This can happen during face validation; try a clearer, front-facing photo.`);
            }
            throw failure;
          }
          await reload();
        } finally { file.value = ""; }
      });
    });
    actionButton(photo, "Remove Image", async () => {
      await apiFetch(`${apiPath}/${id}/image`, { method: "DELETE" }); await reload();
    }, true);

    const credentials = section(showAdministrator ? "Administrator and PIN" : "PIN", "PIN");
    let administrator;
    if (showAdministrator) {
      const adminLabel = element("label", "Administrator", "check");
      administrator = element("input"); administrator.type = "checkbox";
      administrator.checked = item.isAdministrator; adminLabel.append(administrator); credentials.append(adminLabel);
      administrator.addEventListener("change", () => {
        const value = administrator.checked;
        if (!window.confirm(`${value ? "Grant" : "Revoke"} Administrator for ${item.name}? This changes a credential-adjacent device setting.`)) {
          administrator.checked = item.isAdministrator; return;
        }
        runAction(administrator, async () => {
          try {
            await apiFetch(`${apiPath}/${id}/administrator`, jsonOptions("PUT", { isAdmin: value }, { "X-Confirm-Sensitive-Action": "yes" }));
            item.isAdministrator = value;
            await reload();
          } finally { administrator.checked = item.isAdministrator; }
        });
      });
    }
    const pinStatus = element("p", item.hasPassword ? "PIN: Set" : "PIN: Not set"); credentials.append(pinStatus);
    const pinForm = element("form");
    const pin = input(pinForm, "New PIN", "password"); pin.inputMode = "numeric"; pin.pattern = "[0-9]+"; pin.autocomplete = "new-password";
    const setPin = element("button", "Set PIN"); setPin.type = "submit"; pinForm.append(setPin); credentials.append(pinForm);
    pinForm.addEventListener("submit", event => {
      event.preventDefault();
      if (setPin.disabled) return;
      if (!window.confirm(`Set a new PIN for ${item.name}? This cannot be undone or read back later.`)) return;
      runAction(setPin, async () => {
        await apiFetch(`${apiPath}/${id}/password`, jsonOptions("PUT", { password: pin.value }, { "X-Confirm-Sensitive-Action": "yes" }));
        pin.value = "";
        await reload();
      });
    });
    dialog.addEventListener("close", () => { pin.value = ""; dialog.remove(); });
    cardsSubform.refresh(item.cardCount); refreshGroupsPicker(); document.body.append(dialog); dialog.showModal(); name.focus();
  }
}

// epoch seconds <-> the local-time string a native <input type="datetime-local">
// reads/writes. Empty/falsy epoch -> empty string (no value), matching this
// field's "unset" convention elsewhere in this codebase.
function toDatetimeLocalValue(epochSeconds) {
  if (!epochSeconds) return "";
  const d = new Date(epochSeconds * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocalValue(value) {
  if (!value) return null;
  const seconds = Math.floor(new Date(value).getTime() / 1000);
  if (!Number.isFinite(seconds)) throw new Error("Enter a valid date and time.");
  return seconds;
}

function jpegBytes(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This doesn't look like an image. Choose a valid image file."));
    };
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image conversion is unavailable in this browser.");
        context.drawImage(image, 0, 0);
        const data = canvas.toDataURL("image/jpeg", 0.92);
        if (!data.startsWith("data:image/jpeg;base64,")) throw new Error("Unable to convert this image to JPEG. Try a smaller image.");
        const binary = atob(data.split(",")[1]);
        resolve(Uint8Array.from(binary, character => character.charCodeAt(0)));
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(url); }
    };
    image.src = url;
  });
}

initUserListPage({ tabId: "users", apiPath: "/users", itemSingular: "User", itemPlural: "users" });
