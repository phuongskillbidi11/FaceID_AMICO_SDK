# Alarm Output / Relay and GPIOs

> **⚠️ 2026-09-20 superseding notice**: the device this plan's original
> evidence (below) was captured against (`192.168.2.156`) has been
> returned to the factory and is permanently unreachable. A different
> physical unit (`192.168.3.66`, firmware `1.8.7`, a materially older
> generation) is now the only reachable device, and its own
> `alarmconfig.html` uses a **completely different, incompatible**
> device object (3 fields: `buzzer_enabled`/`alarm_central_enabled`/
> `playing_timeout`, not the 17-field GPIO/relay/bell/siren shape
> below). See `DECISION_LOG.md`'s own 2026-09-20 entry for the full
> re-survey. **The "Proposed implementation boundary" section below
> describes the OLD, now-unverifiable device and must not be used as
> the basis for further implementation** — see the new "Current device
> evidence (2026-09-20)" section instead.

## Scope

Define a future read/write implementation plan for the device's Settings →
**Relay and GPIOs** modal, which is the live firmware label corresponding to
the roadmap's Alarm Output area. This plan does not implement or perform writes.

## Live read evidence (2026-09-17)

Read-only Chrome DevTools capture against the authenticated device UI:

- Modal opening caused `POST /get_configuration.fcgi` (HTTP 200).
- Request body:
  `{"general":["buttonhole1_enabled","relay1_enabled","relay1_timeout","relay1_auto_close","gpio_ext1_mode","gpio_ext2_mode","gpio_ext3_mode","relay_out_mode","gpio_ext1_debounce","gpio_ext2_debounce","gpio_ext3_debounce","gpio_ext1_idle","gpio_ext2_idle","gpio_ext3_idle","gpio_ext1_activation_mode","gpio_ext2_activation_mode","gpio_ext3_activation_mode"]}`
- Response body:
  `{"general":{"buttonhole1_enabled":"0","relay1_enabled":"1","relay1_timeout":"3000","relay1_auto_close":"0","gpio_ext1_mode":"5","gpio_ext2_mode":"0","gpio_ext3_mode":"0","relay_out_mode":"0","gpio_ext1_debounce":"50","gpio_ext2_debounce":"50","gpio_ext3_debounce":"50","gpio_ext1_idle":"1","gpio_ext2_idle":"1","gpio_ext3_idle":"1","gpio_ext1_activation_mode":"1","gpio_ext2_activation_mode":"1","gpio_ext3_activation_mode":"1"}}`
- A separate read returned `general.relay_out_mode = "0"`.
- A separate read returned `general.bell_enabled = "0"`, `bell_relay = "1"`,
  `relay1_enabled = "1"`, `alarm.siren_enabled = "0"`, `siren_relay = "1"`.

Static JS evidence (`artifacts/live_capture/configurations.js`) shows the save
handler writes the general GPIO/relay fields, then `alarm.siren_enabled`, then
`general.bell_enabled`. Output mode constants are 0 normal access, 1 rejected
only, 2 bell, 3 siren, 4 emergency.

## Proposed implementation boundary (review draft)

Read-only first:

- `GET /alarm-output` returns a normalized object containing relay state,
  timeout/auto-close, output mode, Bell/Siren state and relay selection, plus
  GPIO1–3 mode/debounce/idle/activation values.
- Preserve raw numeric values where the device semantics are not fully mapped;
  do not silently infer labels for unknown mode values.
- Frontend initially renders the read-only state and source field names. No
  Save control is enabled in the first implementation slice.

Write-side (separate approval gate):

- A later `PUT /alarm-output` may mirror the device's grouped writes, but must
  validate the complete field set and show an explicit before/after summary.
- No live write verification belongs to this plan until the user provides the
  dedicated write token and immediate confirmation for one exact change.

## Current device evidence (2026-09-20) — supersedes the section above

Live Chrome DevTools capture + static read of `en_US/js/pages/alarm_config.js`
against the only currently-reachable device (`192.168.3.66`, firmware `1.8.7`):

```
POST /get_configuration.fcgi {"alarm":["buzzer_enabled","alarm_central_enabled","playing_timeout"]}
  -> {"alarm":{"buzzer_enabled":"1","alarm_central_enabled":"0","playing_timeout":"0"}}
```

3 fields, all JSON strings:
- `buzzer_enabled` ("0"/"1") — device UI label "Buzzer".
- `alarm_central_enabled` ("0"/"1") — device UI label "Maximum
  Activation Time" (the field name and label don't obviously match —
  confirmed this is genuinely what the device's own JS does).
- `playing_timeout` (numeric string, seconds) — the device has no
  separate boolean for this section; the UI's own "enabled" toggle is
  synthetic (client-side `value > 0`), and Save sends `"0"` when that
  toggle is off.

Write: `POST /set_configuration.fcgi {"alarm": {"buzzer_enabled":
"0"|"1", "alarm_central_enabled": "0"|"1", "playing_timeout":
"<seconds>"|"0"}}` — full-replace, all 3 fields every time, same
family of convention as Internal Alarms' own `set_configuration.fcgi`
write.

**Revised proposed implementation** (read + write, since the field
set is tiny and the write shape is now fully evidenced, unlike the old
17-field surface where write was deliberately deferred):
- `AlarmOutputSettings { bool buzzerEnabled; bool maxActivationTimeEnabled; int64_t maxActivationTimeSeconds; }`
  (naming the fields after their own UI labels, not the somewhat
  confusing raw device names, matching this project's own
  `InternalAlarmSettings` precedent of camelCase-by-meaning over
  camelCase-by-wire-name).
- `GET /alarm-output` / `PUT /alarm-output` (`PUT` requires
  `X-Confirm-Sensitive-Action`, matching Internal Alarms' own
  precedent — this also gates a security-relevant alarm behavior).
- The old 17-field GPIO/relay/bell/siren struct and route are replaced
  entirely, not kept alongside — there is no way to verify the old
  shape ever again, and shipping unverifiable code contradicts this
  project's own evidence discipline.

## Safety decisions

1. No write endpoint or UI behavior is implemented by this discovery plan.
2. Any future live write requires a new explicit write approval and immediate
   confirmation for the exact field/value; credentials are never stored or
   hard-coded.
3. Treat “Relay and GPIOs” as the current firmware surface; do not assume a
   separate `alarmconfig.html` route until independently observed.
