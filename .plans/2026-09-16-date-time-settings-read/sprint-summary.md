# Sprint summary — Date and Time settings (read-only)

## What shipped

A single combined read of the device's date/time settings, surfaced
as a new "Date and Time" section on the existing System Information
tab:

- `AmicoClient::getDateTimeSettings()` (SDK): combines
  `system_information.fcgi` (already used elsewhere) with two
  `get_configuration.fcgi` calls and `get_ntp_server.fcgi` into one
  `DateTimeSettings` struct (`time`, `daylightSavingActive`,
  `ntpEnabled`, `timezone`, `clock12HourFormat`,
  `monthDayYearFormat`, `ntpServer1`, `ntpServer2`).
- `GET /settings/date-time` (backend): thin JSON wrapper, no
  `X-Confirm-Sensitive-Action` header (nothing here mutates device
  state).
- `frontend/system-info.js`: extended with a second "Date and Time"
  panel using the same generic definition-list renderer already used
  for System Information — no new sidebar entry.

Entirely read-only end to end, per the plan's own Decision 1 — there
is no write path (`PUT /settings/date-time`) in this plan at all; that
remains its own future item in `docs/api-roadmap.md` section 9.

## New technical finding

A third device boolean-ish convention, distinct from the two already
known (real JSON booleans; 0/1 JSON integers): `get_configuration.fcgi`
encodes `ntp.enabled`, `general.clock_12h_format`, and
`general.month_day_year_format` as JSON *strings* `"0"`/`"1"`. Handled
by a new `requireStringBoolField()` helper in `src/Client.cpp`, which
throws `ProtocolError` for any other string value.

## Groups completed

1. SDK types — `DateTimeSettings` struct.
2. SDK query builders — N/A (fixed-key request bodies, same precedent
   as `system_information.fcgi` itself; no `ObjectQuery` builder
   needed).
3. SDK implementation — `getDateTimeSettings()` + `requireStringBoolField()`.
4. Backend — `toJson(DateTimeSettings)` + `GET /settings/date-time` route.
5. Frontend — extended `system-info.js`.
6. Tests — 4 new SDK cases (`test_system_information.cpp`), 1 new
   backend route test + 1 cookie-gate entry (`test/backend/test_routes.cpp`).
7. Docs — `docs/backend-api.md`, `docs/api-roadmap.md` section 9.
8. Manual live verification — passed against the real device
   (192.168.2.156); see `tasks.md` Task 8.1 for full detail.

## Test results

- `amico_tests.exe`: 255 test cases, 1735 assertions, all passed.
- `amico_backend_tests.exe`: 91 test cases, 893 assertions, all passed.
- No regressions in either suite.

## Notable non-code incident during Group 8

The frontend initially served a stale (pre-edit) copy of
`system-info.js` — resolved by the user restarting the
`amico_backend`/`nginx` services, after which a page reload picked up
the current file. Confirmed via `curl` (response `Last-Modified`
header) that this was a deployment-timing artifact, not a bug in the
edited code itself: the served file's content matched the repo source
exactly once fresh.

## What's next

The write side (`PUT /settings/date-time` — `set_system_time`,
`set_ntp_server`) is intentionally out of scope here and needs its own
discovery/confirm pass before implementing; it likely belongs in the
same risk tier as License Mode (changes device-wide behavior), per
`feedback_write_api_risk_tiers.md`.
