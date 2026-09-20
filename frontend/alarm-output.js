"use strict";

// Alarm Output settings (2026-09-17 plan). Saving replaces all
// three device settings in one request, matching the device's own
// all-or-nothing Save behavior.

(() => {
  const tab = document.getElementById("tab-alarm-output");
  const form = element("form", undefined, "general-form");

  const buzzerLabel = element("label", "Buzzer Enabled", "check");
  const buzzerEnabled = element("input"); buzzerEnabled.type = "checkbox";
  buzzerLabel.prepend(buzzerEnabled); form.append(buzzerLabel);

  const maxActivationTimeLabel = element("label", "Maximum Activation Time Enabled", "check");
  const maxActivationTimeEnabled = element("input"); maxActivationTimeEnabled.type = "checkbox";
  maxActivationTimeLabel.prepend(maxActivationTimeEnabled); form.append(maxActivationTimeLabel);

  const maxActivationTimeSeconds = input(form, "Maximum Activation Time (seconds)", "number");
  const save = element("button", "Save"); save.type = "submit"; form.append(save); tab.append(form);

  async function load() {
    const data = await apiFetch("/alarm-output");
    buzzerEnabled.checked = data.buzzerEnabled;
    maxActivationTimeEnabled.checked = data.maxActivationTimeEnabled;
    maxActivationTimeSeconds.value = String(data.maxActivationTimeSeconds);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    runAction(save, async () => {
      const payload = {
        buzzerEnabled: buzzerEnabled.checked,
        maxActivationTimeEnabled: maxActivationTimeEnabled.checked,
        maxActivationTimeSeconds: Number(maxActivationTimeSeconds.value),
      };
      await apiFetch("/alarm-output", jsonOptions("PUT", payload, { "X-Confirm-Sensitive-Action": "yes" }));
      await load();
    });
  });

  document.addEventListener("tab-activated", event => {
    if (event.detail === "alarm-output") runAction(save, load);
  });
})();
