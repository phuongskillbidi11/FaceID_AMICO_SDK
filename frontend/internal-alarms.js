"use strict";

// Internal Alarms settings (2026-09-16 plan). Saving replaces all
// nine security-relevant device settings in one request, matching
// the device's own all-or-nothing Save behavior.

(() => {
  const tab = document.getElementById("tab-internal-alarms");
  const form = element("form", undefined, "general-form");

  const doorSensorLabel = element("label", "Door Sensor Enabled", "check");
  const doorSensorEnabled = element("input"); doorSensorEnabled.type = "checkbox";
  doorSensorLabel.prepend(doorSensorEnabled); form.append(doorSensorLabel);

  const doorSensorDelay = input(form, "Door Sensor Delay (seconds)", "number");
  const doorSensorAlarmTimeoutAfterClosure = input(form, "Door Sensor Alarm Timeout After Closure (seconds)", "number");

  const forcedAccessLabel = element("label", "Forced Access Enabled", "check");
  const forcedAccessEnabled = element("input"); forcedAccessEnabled.type = "checkbox";
  forcedAccessLabel.prepend(forcedAccessEnabled); form.append(forcedAccessLabel);

  const forcedAccessDebounce = input(form, "Forced Access Debounce (seconds)", "number");

  const deviceViolationLabel = element("label", "Device Violation Enabled", "check");
  const deviceViolationEnabled = element("input"); deviceViolationEnabled.type = "checkbox";
  deviceViolationLabel.prepend(deviceViolationEnabled); form.append(deviceViolationLabel);

  const panicFingerLabel = element("label", "Panic Finger Enabled", "check");
  const panicFingerEnabled = element("input"); panicFingerEnabled.type = "checkbox";
  panicFingerLabel.prepend(panicFingerEnabled); form.append(panicFingerLabel);

  const panicCardLabel = element("label", "Panic Card Enabled", "check");
  const panicCardEnabled = element("input"); panicCardEnabled.type = "checkbox";
  panicCardLabel.prepend(panicCardEnabled); form.append(panicCardLabel);

  const panicFingerDelay = input(form, "Panic Finger Delay (seconds)", "number");
  const save = element("button", "Save"); save.type = "submit"; form.append(save); tab.append(form);

  async function load() {
    const data = await apiFetch("/internal-alarms");
    doorSensorEnabled.checked = data.doorSensorEnabled;
    doorSensorDelay.value = String(data.doorSensorDelay);
    doorSensorAlarmTimeoutAfterClosure.value = String(data.doorSensorAlarmTimeoutAfterClosure);
    forcedAccessEnabled.checked = data.forcedAccessEnabled;
    forcedAccessDebounce.value = String(data.forcedAccessDebounce);
    deviceViolationEnabled.checked = data.deviceViolationEnabled;
    panicFingerEnabled.checked = data.panicFingerEnabled;
    panicCardEnabled.checked = data.panicCardEnabled;
    panicFingerDelay.value = String(data.panicFingerDelay);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    runAction(save, async () => {
      const payload = {
        doorSensorEnabled: doorSensorEnabled.checked,
        doorSensorDelay: Number(doorSensorDelay.value),
        doorSensorAlarmTimeoutAfterClosure: Number(doorSensorAlarmTimeoutAfterClosure.value),
        forcedAccessEnabled: forcedAccessEnabled.checked,
        forcedAccessDebounce: Number(forcedAccessDebounce.value),
        deviceViolationEnabled: deviceViolationEnabled.checked,
        panicFingerEnabled: panicFingerEnabled.checked,
        panicCardEnabled: panicCardEnabled.checked,
        panicFingerDelay: Number(panicFingerDelay.value),
      };
      await apiFetch("/internal-alarms", jsonOptions("PUT", payload, { "X-Confirm-Sensitive-Action": "yes" }));
      await load();
    });
  });

  document.addEventListener("tab-activated", event => {
    if (event.detail === "internal-alarms") runAction(save, load);
  });
})();
