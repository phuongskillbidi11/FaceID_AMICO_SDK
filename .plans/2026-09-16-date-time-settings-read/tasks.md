# Tasks — Date and Time settings (read-only)

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-7** require no device contact — all offline.
> - **Group 8** (manual live verification) is **entirely read-only**
>   (spec.md Decision 1 — no write path in this plan at all),
>   requiring a fresh
>   `APPROVE_LIVE_DEVICE_TEST:2026-09-16-date-time-settings-read`
>   approval. **There is no write-approval step in this plan.**

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `DateTimeSettings`
**Action:**
```cpp
/// Combined read of the device's date/time settings (Date and Time
/// settings plan, 2026-09-16) -- `time`/`daylightSavingActive` come
/// from `system_information.fcgi`; the rest from two
/// `get_configuration.fcgi` calls and `get_ntp_server.fcgi`.
/// Deliberately a separate type from `SystemInformation` (spec.md
/// Decision 2) -- device identity vs. date/time settings are
/// different concerns. Read-only; there is no `DateTimeSettingsUpdate`
/// counterpart (spec.md Decision 1 -- the write side needs its own
/// confirm pass first).
struct DateTimeSettings {
    int64_t time = 0;
    bool daylightSavingActive = false;
    bool ntpEnabled = false;
    std::string timezone;
    bool clock12HourFormat = false;
    bool monthDayYearFormat = false;
    std::string ntpServer1;
    std::string ntpServer2;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — N/A: no new builders needed
**Action:** None. Per spec.md Decision 4, the 3 request bodies this
plan uses (`get_configuration.fcgi` x2, `get_ntp_server.fcgi`) take a
fixed, hardcoded set of keys with zero caller-supplied variability --
the same precedent already established for `system_information.fcgi`
itself, which also has no `ObjectQuery` builder. These bodies are
constructed directly in `src/Client.cpp` (Group 3).
**Verification:** N/A.
**Pass:** N/A.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> N/A — no builders needed, confirmed per spec.md Decision 4.

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `getDateTimeSettings()` method
**Action:** In `include/amico/Client.hpp`, add a direct method on
`AmicoClient` (matching the existing `getSystemInformation()`
precedent -- no new API class needed for a single combined read):
```cpp
/// Combined read: system_information.fcgi's own time/DST fields plus
/// NTP/clock-format/NTP-server settings. Read-only (spec.md
/// Decision 1).
DateTimeSettings getDateTimeSettings();
```
and the matching private `...Impl` declaration
(`DateTimeSettings getDateTimeSettingsImpl();`).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 3.2 — Implement in `src/Client.cpp`
**Action:**
1. Add a new helper alongside `requireBoolLikeField()`:
   ```cpp
   /// Reads a boolean-ish field stored as a JSON *string* "0"/"1" --
   /// LIVE_CONFIRMED convention for get_configuration.fcgi's own
   /// ntp.enabled/general.clock_12h_format/general.month_day_year_format
   /// fields (Date and Time settings plan, 2026-09-16, spec.md
   /// Decision 3) -- distinct from requireBoolLikeField()'s own
   /// boolean-or-0/1-integer convention. Throws ProtocolError for any
   /// value other than "0"/"1".
   bool requireStringBoolField(const nlohmann::json& j, const char* key, const std::string& path) {
       std::string value = requireField<std::string>(j, key, path);
       if (value == "1") return true;
       if (value == "0") return false;
       throw ProtocolError(std::string("field '") + key + "' was not \"0\" or \"1\" in response from " + path);
   }
   ```
2. `DateTimeSettings AmicoClient::Impl::getDateTimeSettings()`:
   - `postAuthenticatedJson("/system_information.fcgi", nullptr)` ->
     `settings.time` (`requireField<int64_t>`), `settings.daylightSavingActive`
     (`requireField<bool>`).
   - `postAuthenticatedJson("/get_configuration.fcgi", {"ntp": ["enabled", "timezone"]})` ->
     unwrap the `"ntp"` section, `settings.ntpEnabled`
     (`requireStringBoolField`), `settings.timezone`
     (`requireField<std::string>`).
   - `postAuthenticatedJson("/get_configuration.fcgi", {"general": ["clock_12h_format", "month_day_year_format"]})` ->
     unwrap the `"general"` section, `settings.clock12HourFormat` /
     `settings.monthDayYearFormat` (both `requireStringBoolField`).
   - `postAuthenticatedJson("/get_ntp_server.fcgi", nlohmann::json::object())` ->
     `settings.ntpServer1`/`ntpServer2` (`requireField<std::string>`
     on `"server1"`/`"server2"`).
   - Return the populated `DateTimeSettings`.
3. Wire `AmicoClient::getDateTimeSettingsImpl()` -> `impl_->getDateTimeSettings()`,
   and the public `AmicoClient::getDateTimeSettings()` -> the `...Impl` call.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 4 — Backend (`backend/JsonMapping.cpp`, `backend/Routes.cpp`)

### Task 4.1 — `toJson(DateTimeSettings)`
**Action:** In `backend/JsonMapping.cpp`/`.hpp`, add
`toJson(const amico::DateTimeSettings&)` -> `{"time", "daylightSavingActive",
"ntpEnabled", "timezone", "clock12HourFormat", "monthDayYearFormat",
"ntpServer1", "ntpServer2"}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build.

---

### Task 4.2 — `GET /settings/date-time` route
**Action:** In `backend/Routes.cpp`, add (mirroring the existing
`GET /system-information` route's own simple shape):
`GET /settings/date-time` -> `200 <DateTimeSettings JSON>`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build
> (required stopping/restarting the `amico_backend`/`nginx` services
> via the standing UAC-elevation procedure; the first 2 UAC prompts
> were canceled, the 3rd succeeded once the user was ready). Health
> check `curl http://127.0.0.1:8080/session` returned 200.

---

## Group 5 — Frontend

### Task 5.1 — Extend `frontend/system-info.js` with a Date and Time panel
**Action:** Load the `frontend-design` skill first (standing project
instruction). Extend the existing "System Information" tab
(`frontend/system-info.js`) with a second section: fetch
`GET /settings/date-time` alongside the existing
`GET /system-information` call, rendering it via the same generic
definition-list renderer already used there, under a "Date and Time"
heading. No new sidebar entry -- this is a small, read-only addition
to an already-existing single-page tab (Simplicity First), not a
reason to invent a new "Settings" sidebar section for one item.
**Verification:** `node --check frontend/system-info.js`.
**Pass:** Exit 0.
**Fail:** Syntax error.

**Status:** `[x]`
**Verification result:**
> `node --check frontend/system-info.js` — exit 0, no syntax errors.

---

## Group 6 — Tests

### Task 6.1 — `test/test_system_information.cpp` additions
**Action:** Add cases for `AmicoClient::getDateTimeSettings()`: all 3
calls' responses mapped correctly, including the string-boolean
parsing (`requireStringBoolField()` accepting `"0"`/`"1"`, throwing
`ProtocolError` for any other string value).
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; no regressions.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_tests` — exit 0, clean build.
> `./build/amico_tests.exe` — 255 test cases, 1735 assertions, all
> passed, no regressions. Added 4 new cases: full-flow field mapping,
> "0"/"1" string-boolean acceptance (looped both values), and a
> ProtocolError case for an invalid string-boolean value ("yes").

---

### Task 6.2 — `test/backend/test_routes.cpp`
**Action:** Add a route test for `GET /settings/date-time`.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend_tests` — exit 0, clean
> build. `./build/amico_backend_tests.exe` — 91 test cases, 893
> assertions, all passed, no regressions. Added a mapping test plus a
> cookie-gate-rejection entry for `/settings/date-time`.

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:** Add a `GET /settings/date-time` section to
`docs/backend-api.md`. Update `docs/api-roadmap.md` section 9 to
reflect the read side shipped, keeping the write side explicitly
marked as its own future item.
**Verification:** Manual review (docs-only change, no build step).
**Pass:** Both files updated consistently with the shipped behavior.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> Manual review — added a `GET /settings/date-time` section to
> `docs/backend-api.md` (matching the existing `GET /system-information`
> section's own style) and updated `docs/api-roadmap.md` section 9 from
> "📋 Planned" to "✅ read side implemented," documenting the 3rd
> boolean-ish device convention and the 4-request combination; the
> write side (`PUT /settings/date-time`) is kept explicitly 📋 with its
> own confirm-pass caveat.

---

## Group 8 — Manual live verification (read-only only)

### Task 8.1 — Read-only: Date and Time panel loads correctly
**Action:** **Before running:** obtain
`APPROVE_LIVE_DEVICE_TEST:2026-09-16-date-time-settings-read` (no
write token needed anywhere in this plan). Log into the real device
via our own frontend, open System Information, confirm the new Date
and Time panel shows correct values matching a direct device query
(time, DST, NTP enabled/timezone, clock/date format, NTP servers).
Confirm no regression on the existing System Information data.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** All fields display correctly and match the device's own
values; no regressions elsewhere.
**Fail:** Any regression, wrong data, or console error.

**Status:** `[x]`
**Verification result:**
> Manual, via chrome-devtools-mcp against the real device
> (192.168.2.156), token `APPROVE_LIVE_DEVICE_TEST:2026-09-16-date-time-settings-read`
> pasted by the user. Logged into our own frontend, opened System
> Information: the existing panel showed correctly (serial,
> firmwareVersion, network.*, etc., no regression), and the new "Date
> and Time" panel rendered all 8 `DateTimeSettings` fields with real
> device values (`ntpServer1: "vn.pool.ntp.org"`, `ntpServer2:
> "pool.ntp.org"`, `timezone: "UTC+7"`, `time: 1789573730` -- sane
> epoch matching today's date, `ntpEnabled/clock12HourFormat/
> monthDayYearFormat: false`, `daylightSavingActive: false`). No
> console errors (only a pre-existing, unrelated a11y issue on the
> login form). One transient artifact along the way: the frontend
> initially served a stale (pre-edit) copy of `system-info.js` until
> the user restarted the backend/nginx services, after which a reload
> picked up the current file correctly -- not a code bug, confirmed by
> diffing the served file's content before/after the restart against
> the repo source.

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 complete
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are additive modifications to existing,
already-working files (no new files this plan). Revert via
`git diff`/`git checkout --` against this plan's own changes if needed
(check `git status` first per standing safety practice).
