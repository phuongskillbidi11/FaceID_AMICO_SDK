# Decision log

- 2026-09-17: Current firmware exposes the target as Settings → “Relay and
  GPIOs”; plan keeps the roadmap name “Alarm Output” as an alias only.
- 2026-09-17: Captured live GET payloads read-only. No Save button, PUT, or
  other device write was invoked.
- 2026-09-17: User-provided credentials were not recorded, embedded, or
  reused by this plan.
- 2026-09-17: Scope draft is read-only `GET /alarm-output` first; write-side
  PUT and live verification remain a separate approval gate.
- 2026-09-17: Implemented the SDK/backend read-only slice. The SDK performs
  separate `general` and `alarm` reads to match the live-captured request
  grouping; no device write path was added.
- 2026-09-17: Added a Settings hub with icon/card-style navigation. Relay /
  Door Actions remains separate because it triggers physical hardware.
- 2026-09-17: Refined the hub after direct native-device inspection: flat
  light-gray tiles, large centered black SVG icons, centered labels, and a
  responsive multi-column grid matching the device's Settings visual pattern.
- **2026-09-20 — CRITICAL: the original device (192.168.2.156) was returned
  to the factory. A different physical unit is now in use
  (192.168.3.66, firmware `1.8.7`, secbox `0.16.20`, serial
  `0Z0100/0004AB` — vs. the old unit's `2.4.5`/`2.2.3`/`1Z0100/000D3D`).
  This is a materially older firmware/hardware generation, not the same
  device. Live re-survey of Alarm Output against this actual reachable
  device found its `alarmconfig.html` uses a COMPLETELY DIFFERENT
  device object than the one this plan's Group 2 code was built
  against:**
  ```
  POST /get_configuration.fcgi {"alarm":["buzzer_enabled","alarm_central_enabled","playing_timeout"]}
    -> {"alarm":{"buzzer_enabled":"1","alarm_central_enabled":"0","playing_timeout":"0"}}
  ```
  Only **3 fields**, all JSON strings -- confirmed via both a live
  Chrome DevTools network capture (`alarmconfig.html`'s own live
  request) and a static read of this device's own
  `en_US/js/pages/alarm_config.js`. None of the 17 GPIO/relay/bell/
  siren fields the existing `AlarmOutputSettings`/`getAlarmOutputSettings()`
  code requests (`buttonhole1_enabled`, `relay1_enabled`,
  `gpio_ext1/2/3_mode`, etc.) exist in this device's own `alarm_config.js`
  at all -- calling the currently-shipped `GET /alarm-output` against
  this device would very likely get a `400` ("X is not a valid field
  of object alarm") for most of those fields, not the data this plan
  intended to show.

  **UI/field semantics** (from `alarm_config.js`, own labels in
  `alarmconfig.html`):
  - `buzzer_enabled` ("0"/"1") -- "Buzzer" Active toggle.
  - `alarm_central_enabled` ("0"/"1") -- "Maximum Activation Time"
    Active toggle (the field name and its own UI label do not obviously
    match -- this is exactly what the device's own JS does, not a
    misreading).
  - `playing_timeout` (a numeric string, seconds) -- doubles as its own
    enabled-flag: the UI's own separate "enabled" toggle for this
    section is **synthetic, client-side only** (`data.playing_timeout > 0`
    on load; on save, sends `"0"` if that toggle is off, otherwise the
    textbox value) -- there is no separate device-side boolean for this
    one.
  - Write: `POST /set_configuration.fcgi {"alarm": {"buzzer_enabled":
    "0"|"1", "alarm_central_enabled": "0"|"1", "playing_timeout":
    "<seconds-as-string>"|"0"}}`. Unlike `alarmint.html`'s own apparent
    `data`-reuse bug (Internal Alarms plan's own spec.md Background),
    this page's save handler correctly reassigns `data` via `var data =
    MessengerUtil.send('set_configuration', ...)` inside the same
    function scope, so its own `if ('error' in data)` check *does*
    inspect the real write response -- not the same bug.

  **Internal Alarms cross-check on this same device** (already-shipped
  feature, re-verified for safety): the same 9 fields this project's
  `InternalAlarmSettings` already reads/writes are confirmed present
  and correctly typed here too, **plus one new field this device has
  that the shipped struct does not yet know about**:
  `reset_on_violation_enabled` ("0"/"1"). The existing 9-field
  read/write still functions (a subset request is fine, matching this
  project's established `get_configuration.fcgi` convention elsewhere),
  it just cannot show or manage this 10th field yet. Not a break, but a
  known gap -- worth a small follow-up task, not an emergency.

  **Relay/Door Actions cross-check**: this device's own sidebar shows
  only "Open Door" (no "Open relay") -- consistent with this plan's own
  already-shipped design (`listRelayActions()` re-derives fresh from
  `relay_count`/`relay_out_mode`/`catra_role` every call), just a
  different resolved result on different device config. No code
  change needed there.

  **Decision**: The Alarm Output feature is genuinely device/firmware-
  specific -- "Relay and GPIOs" (old unit) and "Alarm Output" /
  `alarm_config.js` (this unit) are two unrelated device object shapes
  that happen to share a roadmap name. Since the old unit is gone and
  unreachable for good, and this project's own iron rule is never
  shipping a wire shape that cannot currently be verified, the
  responsible path is to **redesign this plan's own `AlarmOutputSettings`
  struct and route around the 3-field shape actually confirmed on the
  device this project can currently reach**, rather than keeping the
  old 17-field code as the shipped implementation. The old evidence
  stays recorded in this file for history, but is no longer the basis
  for what ships.

- 2026-09-20: Task 3.9 (SDK + backend tests) hung on `codex exec` twice
  in a row -- attempt 1 ran ~1h04m, attempt 2 ran ~40m, both with zero
  file writes and zero streamed output (Tasks 3.6/3.7/3.8 by contrast
  each completed in a few minutes to ~20 minutes with real output).
  Both hung runs were killed via TaskStop after confirming via `git
  status`/`ls` that no partial file writes existed, so nothing was at
  risk. After the second hang, the task was written directly by the
  orchestrating session instead of retrying a third time: added
  `test/test_alarm_output.cpp` (5 cases mirroring
  `test_internal_alarms.cpp`), registered it in `CMakeLists.txt`, and
  added 3 route tests + 2 cookie-gate matrix entries to
  `test/backend/test_routes.cpp`. Full suites verified green
  (`amico_tests.exe` 275/275, `amico_backend_tests.exe` 102/102).
  **Established practice going forward**: if a `codex exec` background
  task exceeds ~20-30 minutes with no file writes and no output while a
  comparable prior task in the same plan finished much faster, treat it
  as hung rather than waiting indefinitely -- kill it, confirm no
  partial writes, and prefer writing the task directly over a third
  retry.
