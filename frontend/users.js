"use strict";

(() => {
  const tab = document.getElementById("tab-users");
  const refresh = element("button", "Refresh");
  const add = element("button", "Add User");
  tab.append(add, refresh);
  const addForm = element("form");
  addForm.hidden = true;
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
  const newName = input(addForm, "Name");
  const newRegistration = input(addForm, "Employee ID");
  newRegistration.required = false;
  const create = element("button", "Create user");
  create.type = "submit";
  addForm.append(create);
  tab.append(addForm);
  add.addEventListener("click", () => { addForm.hidden = !addForm.hidden; if (!addForm.hidden) newName.focus(); });
  const wrap = element("div", undefined, "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headings = element("tr");
  ["Image", "Id", "Name", "Employee ID", "Password", "Start Date/Time", "End Date/Time", "Nº of Groups", "Nº of Cards", "Face", "Last Access Date/Time", "Administrator", "Edit", "Remove"].forEach(title => {
    const th = element("th", title); th.scope = "col"; headings.append(th);
  });
  head.append(headings);
  const body = element("tbody");
  table.append(head, body); wrap.append(table); tab.append(wrap);
  const status = element("p"); status.setAttribute("role", "status"); tab.append(status);
  const sessionCards = new Map();
  let listVersion = 0;

  function actionButton(parent, title, action, danger = false) {
    const button = element("button", title, danger ? "danger" : undefined);
    button.type = "button";
    button.addEventListener("click", () => runAction(button, action));
    parent.append(button);
    return button;
  }

  async function loadUsers() {
    const version = ++listVersion;
    const users = await apiFetch("/users");
    if (version !== listVersion) return;
    body.replaceChildren();
    users.forEach(user => {
      const row = element("tr");
      const photo = element("td");
      const placeholder = () => photo.replaceChildren(element("span", "No image", "placeholder"));
      if (user.imageUrl) {
        const image = element("img", undefined, "thumbnail");
        image.alt = `Photo of ${user.name}`;
        image.addEventListener("error", placeholder, { once: true });
        image.src = user.imageUrl;
        photo.append(image);
      } else placeholder();
      row.append(photo);
      [user.id, user.name, user.registration].forEach(value => row.append(element("td", value)));
      const password = element("td"); password.append(element("span", user.hasPassword ? "Set" : "Not set", "badge")); row.append(password);
      [formatTime(user.beginTime), formatTime(user.endTime), user.groupCount, user.cardCount, user.faceCount, formatTime(user.lastAccess)].forEach(value => row.append(element("td", value)));
      const admin = element("td"); admin.append(element("span", user.isAdministrator ? "Yes" : "No", "badge")); row.append(admin);
      const editCell = element("td"); actionButton(editCell, "Edit", () => openEditor(user.id)); row.append(editCell);
      const removeCell = element("td");
      actionButton(removeCell, "Remove", async () => {
        if (!window.confirm(`Remove ${user.name}? This permanently deletes the user and cannot be undone.`)) return;
        await apiFetch(`/users/${user.id}`, { method: "DELETE" });
        sessionCards.delete(user.id);
        await loadUsers();
      }, true);
      row.append(removeCell); body.append(row);
    });
    status.textContent = users.length ? `${users.length} users` : "No users found.";
  }

  refresh.addEventListener("click", () => runAction(refresh, loadUsers));
  document.addEventListener("tab-activated", event => {
    if (event.detail === "users") runAction(refresh, loadUsers);
  });
  addForm.addEventListener("submit", event => {
    event.preventDefault();
    runAction(create, async () => {
      await apiFetch("/users", jsonOptions("POST", { name: newName.value, registration: newRegistration.value }));
      addForm.reset(); addForm.hidden = true;
      await loadUsers();
    });
  });

  async function openEditor(id) {
    let user = await apiFetch(`/users/${id}`);
    // Separate editor instances keep in-flight actions attached to their user.
    if (document.querySelector("dialog[open]")) return;
    const dialog = element("dialog");
    const title = element("h2", `Edit ${user.name}`);
    title.id = "edit-user-title"; dialog.setAttribute("aria-labelledby", title.id);
    dialog.append(title);
    actionButton(dialog, "Close", () => dialog.close());
    const error = element("div", undefined, "dialog-error");
    error.hidden = true; error.setAttribute("role", "alert"); dialog.append(error);
    actionButton(dialog, "Dismiss error", hideError);
    const details = element("form");
    const name = input(details, "Name"); name.value = user.name;
    const registration = input(details, "Employee ID"); registration.required = false; registration.value = user.registration;
    const save = element("button", "Save details"); save.type = "submit"; details.append(save); dialog.append(details);
    function section(label) {
      const fieldset = element("fieldset"); fieldset.append(element("legend", label)); dialog.append(fieldset); return fieldset;
    }
    const groups = section("Groups");
    const groupList = element("p"); groups.append(groupList);
    const groupForm = element("form");
    const groupId = input(groupForm, "Group ID", "number"); groups.append(groupForm);
    const cards = section("Cards");
    const cardCount = element("p"); cards.append(cardCount);
    cards.append(element("p", "Only cards added during this page session can be listed here. Existing card details are not available."));
    const cardList = element("ul"); cards.append(cardList);
    const cardForm = element("form");
    const areaCode = input(cardForm, "Area code", "number"); areaCode.max = "4294967295";
    const cardNumber = input(cardForm, "Card number", "number"); cardNumber.max = "4294967295";
    const addCard = element("button", "Add card"); addCard.type = "submit"; cardForm.append(addCard); cards.append(cardForm);
    function renderMemberships() {
      groupList.textContent = `Group IDs: ${(user.groupIds || []).join(", ") || "None"}`;
      cardCount.textContent = `Cards on device: ${user.cardCount}`;
      cardList.replaceChildren();
      (sessionCards.get(id) || []).forEach(card => {
        const item = element("li", `Card ${card.cardId}: ${card.areaCode} / ${card.cardNumber}`);
        actionButton(item, "Remove", async () => {
          await apiFetch(`/cards/${card.cardId}`, { method: "DELETE" });
          sessionCards.set(id, (sessionCards.get(id) || []).filter(entry => entry.cardId !== card.cardId));
          renderMemberships();
          await reload();
        }, true);
        cardList.append(item);
      });
    }
    async function reload() {
      user = await apiFetch(`/users/${id}`);
      title.textContent = `Edit ${user.name}`;
      administrator.checked = user.isAdministrator;
      pinStatus.textContent = user.hasPassword ? "PIN: Set" : "PIN: Not set";
      renderMemberships();
      await loadUsers();
    }
    details.addEventListener("submit", event => {
      event.preventDefault();
      runAction(save, async () => {
        const changes = {};
        if (name.value !== user.name) changes.name = name.value;
        if (registration.value !== user.registration) changes.registration = registration.value;
        if (!Object.keys(changes).length) return;
        await apiFetch(`/users/${id}`, jsonOptions("PATCH", changes));
        await reload();
      });
    });
    ["POST", "DELETE"].forEach(method => actionButton(groupForm, method === "POST" ? "Add group" : "Remove group", async () => {
      if (!groupForm.reportValidity()) return;
      await apiFetch(`/users/${id}/groups/${Number(groupId.value)}`, { method });
      await reload();
    }));
    groupForm.addEventListener("submit", event => event.preventDefault());
    cardForm.addEventListener("submit", event => {
      event.preventDefault();
      runAction(addCard, async () => {
        const card = { areaCode: Number(areaCode.value), cardNumber: Number(cardNumber.value) };
        const result = await apiFetch(`/users/${id}/cards`, jsonOptions("POST", card));
        sessionCards.set(id, [...(sessionCards.get(id) || []), { ...card, cardId: result.cardId }]);
        cardForm.reset(); renderMemberships(); await reload();
      });
    });

    const photo = section("Face image");
    photo.append(element("p", "Choose a clear, front-facing photo. Uploading enrolls the face recognition template."));
    const file = input(photo, "Image", "file"); file.accept = "image/*"; file.required = false;
    file.addEventListener("change", () => {
      const selected = file.files[0];
      if (!selected) return;
      runAction(file, async () => {
        try {
          const bytes = await jpegBytes(selected);
          try {
            await apiFetch(`/users/${id}/image`, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
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
      await apiFetch(`/users/${id}/image`, { method: "DELETE" }); await reload();
    }, true);

    const credentials = section("Administrator and PIN");
    const adminLabel = element("label", "Administrator", "check");
    const administrator = element("input"); administrator.type = "checkbox";
    administrator.checked = user.isAdministrator; adminLabel.append(administrator); credentials.append(adminLabel);
    administrator.addEventListener("change", () => {
      const value = administrator.checked;
      if (!window.confirm(`${value ? "Grant" : "Revoke"} Administrator for ${user.name}? This changes a credential-adjacent device setting.`)) {
        administrator.checked = user.isAdministrator; return;
      }
      runAction(administrator, async () => {
        try {
          await apiFetch(`/users/${id}/administrator`, jsonOptions("PUT", { isAdmin: value }, { "X-Confirm-Sensitive-Action": "yes" }));
          user.isAdministrator = value;
          await reload();
        } finally { administrator.checked = user.isAdministrator; }
      });
    });
    const pinStatus = element("p", user.hasPassword ? "PIN: Set" : "PIN: Not set"); credentials.append(pinStatus);
    const pinForm = element("form");
    const pin = input(pinForm, "New PIN", "password"); pin.inputMode = "numeric"; pin.pattern = "[0-9]+"; pin.autocomplete = "new-password";
    const setPin = element("button", "Set PIN"); setPin.type = "submit"; pinForm.append(setPin); credentials.append(pinForm);
    pinForm.addEventListener("submit", event => {
      event.preventDefault();
      if (setPin.disabled) return;
      if (!window.confirm(`Set a new PIN for ${user.name}? This cannot be undone or read back later.`)) return;
      runAction(setPin, async () => {
        await apiFetch(`/users/${id}/password`, jsonOptions("PUT", { password: pin.value }, { "X-Confirm-Sensitive-Action": "yes" }));
        pin.value = "";
        await reload();
      });
    });
    dialog.addEventListener("close", () => { pin.value = ""; dialog.remove(); });
    renderMemberships(); document.body.append(dialog); dialog.showModal();
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
})();
