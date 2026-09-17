# Tasks — Internal Alarms (Settings, read + write)

> **THIS PLAN IS FOR CODEX CLI HAND-OFF.** The orchestrating session
> (Claude Code) does NOT edit files directly for this plan. For each
> task: run `eng context bundle executor .plans/2026-09-16-internal-alarms-settings`
> to get the current task, then
> `eng tools invoke executor codex.execute .plans/2026-09-16-internal-alarms-settings "<task text + write_scope>"`
> to make the change, then the orchestrating session runs the
> verification command itself and marks `[x]`/`[!]` itself (per
> `core/executor/METHOD.md` — steps 4/5 of the task loop are NEVER
> delegated to Codex). Tasks below are written self-contained
> (exact device calls, exact field names, exact code) so Codex needs
> no conversation history to act correctly.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Group 1's Task 1.1 requires a live read-only check** (device
>   config values differ per install; this is not a device-write, but
>   still needs `APPROVE_LIVE_DEVICE_TEST:2026-09-16-internal-alarms-settings`
>   before it runs, per this project's standing live-device-contact
>   discipline — the human must paste this token literally in chat,
>   an approval selected through a menu/question does not count).
> - **Groups 2-7** require no further device contact.
> - **Group 8** (manual live verification) has both a read-only task
>   (needs the same test token again if the session has changed) and a
>   genuine WRITE task (needs
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-internal-alarms-settings`,
>   pasted literally, before running) — this changes real device
>   security settings, so Task 8.2 must read the original values first
>   and restore them exactly afterward (spec.md's own Risk note).
> - **If at any point the executor cannot drive a browser** (no
>   chrome-devtools-mcp or equivalent access), **stop Group 8 and
>   report this back to a human** rather than skipping live
>   verification silently (spec.md's own "Execution model" section).

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Live discovery: confirm the numeric fields' JSON type
**Action:** Obtain `APPROVE_LIVE_DEVICE_TEST:2026-09-16-internal-alarms-settings`
from a human (pasted literally in chat, not selected via a menu).
Then, authenticated against the real device, call:
```
POST /get_configuration.fcgi
{"alarm": ["door_sensor_enabled", "door_sensor_delay",
  "door_sensor_alarm_timeout_after_closure", "forced_access_enabled",
  "forced_access_debounce", "device_violation_enabled",
  "panic_finger_enabled", "panic_card_enabled", "panic_finger_delay"]}
```
Record the raw response in `DECISION_LOG.md` under a new dated entry.
Specifically note, for each of `door_sensor_delay`,
`door_sensor_alarm_timeout_after_closure`, `forced_access_debounce`,
`panic_finger_delay`: is the JSON value a number (e.g. `5`) or a
string (e.g. `"5"`)? This determines Task 1.2's exact field-parsing
code below.
**Verification:** `DECISION_LOG.md` has a new entry recording the raw
response and the numeric-type finding.
**Pass:** Entry written, finding unambiguous.
**Fail:** Device unreachable, or the response shape doesn't match
spec.md Background's field list (stop, report to a human — do not
guess).

**Status:** `[x]`
**Verification result:**
> Performed by the Planner directly (not Codex — see DECISION_LOG.md's
> own "Codex hand-off attempted and empirically confirmed blocked"
> entry: Codex has no path to an authenticated device session and
> correctly declined to extract credentials to get one). Raw response
> captured; all 4 numeric fields confirmed to be JSON strings, not
> numbers. Full finding in DECISION_LOG.md's own "Task 1.1 live
> discovery result" entry.

---

### Task 1.2 — Add `InternalAlarmSettings`
**Action:** Using Task 1.1's finding, add to `include/amico/Types.hpp`
(placed after the existing `RelayAction` struct):
```cpp
/// Combined read/write of the device's Internal Alarms settings
/// (Internal Alarms settings plan, 2026-09-16). Full-replace write
/// only (spec.md Decision 2) -- the device's own Save button always
/// resends every field; there is no partial-update path. Boolean
/// fields are read/written as the JSON-string "0"/"1" convention
/// (LIVE_CONFIRMED via the device's own write-side JS; see
/// requireStringBoolField()). Numeric fields' exact JSON read-side
/// type was confirmed live in this plan's own Task 1.1 -- see
/// DECISION_LOG.md.
struct InternalAlarmSettings {
    bool doorSensorEnabled = false;
    int64_t doorSensorDelay = 0;
    int64_t doorSensorAlarmTimeoutAfterClosure = 0;
    bool forcedAccessEnabled = false;
    int64_t forcedAccessDebounce = 0;
    bool deviceViolationEnabled = false;
    bool panicFingerEnabled = false;
    bool panicCardEnabled = false;
    int64_t panicFingerDelay = 0;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Executed via `eng tools invoke executor codex.execute` (25,118
> tokens — a pure file edit, no device contact needed). Orchestrating
> session independently re-ran `cmake --build build --target amico_sdk`
> — exit 0 (`ninja: no work to do`, confirming Codex's own build
> already succeeded and nothing else changed).

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — N/A: no new builders needed
**Action:** None. `get_configuration.fcgi`/`set_configuration.fcgi`
take fixed, hardcoded keys with zero caller-supplied variability --
same precedent as every prior `get_configuration.fcgi`-based plan
this project has shipped (Date and Time, License Mode, Relay/Door
actions).
**Verification:** N/A.
**Pass:** N/A.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> N/A — no builders needed, confirmed per spec.md.

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `getInternalAlarmSettings()` / `setInternalAlarmSettings()` methods
**Action:** In `include/amico/Client.hpp`, add (near the existing
`getLicenseInfo()`/`listRelayActions()` methods):
```cpp
/// Reads the device's current Internal Alarms settings (Internal
/// Alarms settings plan, 2026-09-16).
InternalAlarmSettings getInternalAlarmSettings();

/// Full-replace write of Internal Alarms settings (spec.md
/// Decision 2 -- always sends every field, matching the device's own
/// Save button). Changes real security-relevant device behavior.
void setInternalAlarmSettings(const InternalAlarmSettings& settings);
```
and the matching private `...Impl` declarations.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Executed via `eng tools invoke executor codex.execute` (24,771
> tokens). Orchestrating session independently re-ran `cmake --build
> build --target amico_sdk` — exit 0 (`ninja: no work to do`,
> confirming Codex's own build already succeeded).

---

### Task 3.2 — Implement in `src/Client.cpp`
**Action:**
1. `InternalAlarmSettings AmicoClient::Impl::getInternalAlarmSettings()`:
   - `postAuthenticatedJson("/get_configuration.fcgi", {"alarm": [<the 9 field names from spec.md Background>]})`.
   - Unwrap `"alarm"`. Read the 5 boolean fields via
     `requireStringBoolField()`. Read the 4 numeric fields using
     whichever approach Task 1.1 confirmed: if the device returns real
     JSON numbers, `requireField<int64_t>(...)`; if it returns
     number-strings, `requireField<std::string>(...)` then
     `std::stoll(...)` (matching the `relay_count` precedent in
     `listRelayActions()`).
   - Return the populated struct.
2. `void AmicoClient::Impl::setInternalAlarmSettings(const InternalAlarmSettings& settings)`:
   - Build the write body exactly matching spec.md Background's
     captured shape -- **every field as a JSON string**, regardless of
     what Task 1.1 found for the read side (the write side is already
     LIVE_CONFIRMED from the static JS read: `.val()` always produces
     a string, and boolean fields are explicitly `'1'`/`'0'` string
     literals in the device's own code):
     ```cpp
     nlohmann::json body = {{"alarm", {
         {"door_sensor_enabled", settings.doorSensorEnabled ? "1" : "0"},
         {"door_sensor_delay", std::to_string(settings.doorSensorDelay)},
         {"door_sensor_alarm_timeout_after_closure", std::to_string(settings.doorSensorAlarmTimeoutAfterClosure)},
         {"forced_access_enabled", settings.forcedAccessEnabled ? "1" : "0"},
         {"forced_access_debounce", std::to_string(settings.forcedAccessDebounce)},
         {"device_violation_enabled", settings.deviceViolationEnabled ? "1" : "0"},
         {"panic_finger_enabled", settings.panicFingerEnabled ? "1" : "0"},
         {"panic_card_enabled", settings.panicCardEnabled ? "1" : "0"},
         {"panic_finger_delay", std::to_string(settings.panicFingerDelay)},
     }}};
     ```
   - `postAuthenticatedJson("/set_configuration.fcgi", body)`. This
     project has never called `set_configuration.fcgi` before --
     there is no known success/error response shape. Do **not**
     replicate the device's own apparent `if ('error' in data)` bug
     (spec.md Background -- that checks stale data from the earlier
     read, not this write's own response). For this first
     implementation: treat any 2xx HTTP response as success (the
     existing `postAuthenticatedJson()` helper already throws
     `HttpError` for a non-2xx status); do not attempt to parse a
     specific in-body error field yet, since none is evidenced. If
     Group 8's live write test discovers a real error-response
     convention, update this method and record the finding in
     `DECISION_LOG.md` before marking Group 8 complete.
3. Wire the public methods -> the `...Impl` calls.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Executed via `eng tools invoke executor codex.execute` (42,321
> tokens). Orchestrating session independently re-ran `cmake --build
> build --target amico_sdk` — exit 0. Code matches spec exactly: 5
> booleans via `requireStringBoolField()`, 4 numerics via
> `requireField<std::string>()` + `std::stoll()`, write side sends all
> 9 fields as JSON strings, no attempt to parse a
> `set_configuration.fcgi` error shape (correctly deferred to Group 8).

---

## Group 4 — Backend (`backend/JsonMapping.cpp`, `backend/Routes.cpp`)

### Task 4.1 — `toJson(InternalAlarmSettings)` / `fromJsonInternalAlarmSettings(...)`
**Action:** In `backend/JsonMapping.cpp`/`.hpp`:
- `toJson(const amico::InternalAlarmSettings&)` -> a JSON object with
  camelCase keys matching the struct's own member names exactly
  (`doorSensorEnabled`, `doorSensorDelay`,
  `doorSensorAlarmTimeoutAfterClosure`, `forcedAccessEnabled`,
  `forcedAccessDebounce`, `deviceViolationEnabled`,
  `panicFingerEnabled`, `panicCardEnabled`, `panicFingerDelay`).
- `amico::InternalAlarmSettings fromJsonInternalAlarmSettings(const nlohmann::json& body)`
  -> parses the same 9 camelCase keys via `body.at(key).get<T>()`
  (matching this project's existing `fromJsonNew*`/`fromJson*Update`
  convention -- throws `nlohmann::json::exception` on a missing/wrong-
  typed field, which the route handler must catch and map to 400,
  same as every other `fromJson*` function in this file).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Executed via `eng tools invoke executor codex.execute` (45,487
> tokens). Orchestrating session independently rebuilt after the
> standard UAC-elevation stop/rebuild/restart dance (`amico_backend.exe`
> locked; several UAC prompts were canceled before one succeeded).
> `./build/amico_backend_tests.exe` — 96 test cases, 949 assertions,
> all passed, no regressions. Health check
> `curl http://127.0.0.1:8080/session` returned 200.

---

### Task 4.2 — `GET /internal-alarms`, `PUT /internal-alarms`
**Action:** In `backend/Routes.cpp`:
- `GET /internal-alarms` -> `200 <InternalAlarmSettings JSON>` (no
  confirmation header -- read-only).
- `PUT /internal-alarms` -> requires `X-Confirm-Sensitive-Action`
  (spec.md Decision 3). Parses the body via
  `fromJsonInternalAlarmSettings`, catches parse exceptions and maps
  to 400 (matching every other `PUT`/`POST` route in this file's own
  2-stage try/catch convention: parse first with its own catch block,
  then a second try/catch around the actual SDK call). `200
  {"success": true}` on success.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Executed via `eng tools invoke executor codex.execute` (47,545
> tokens). Codex correctly compiled successfully and reported the
> LNK1168 lock rather than attempting the UAC dance itself (per
> `core/executor/METHOD.md`'s stop conditions). Orchestrating session
> ran the standard UAC-elevation stop/rebuild/restart dance — exit 0.
> `./build/amico_backend_tests.exe` — 96 test cases, 949 assertions,
> all passed. Health check `curl http://127.0.0.1:8080/session`
> returned 200.

---

## Group 5 — Frontend

### Task 5.1 — New `frontend/internal-alarms.js` + sidebar entry
**Action:** New file `frontend/internal-alarms.js`: a new sidebar
section "Internal Alarms" with a form containing 5 checkboxes
(matching the existing checkbox pattern in `frontend/user-types.js`'s
own "Requires Visit" field -- a `<label class="check">` wrapping an
`<input type="checkbox">`) for `doorSensorEnabled`,
`forcedAccessEnabled`, `deviceViolationEnabled`, `panicFingerEnabled`,
`panicCardEnabled`, and 4 numeric text inputs (matching the existing
`input(...)` helper pattern) for `doorSensorDelay`,
`doorSensorAlarmTimeoutAfterClosure`, `forcedAccessDebounce`,
`panicFingerDelay`. On load, `GET /internal-alarms` populates the
form. A "Save" button submits the whole form via
`PUT /internal-alarms` with
`jsonOptions("PUT", payload, { "X-Confirm-Sensitive-Action": "yes" })`
(matching `frontend/users.js`'s own existing pattern for its
password/administrator writes), then reloads. Wire into
`frontend/index.html` (new top-level sidebar entry, matching
`relay-actions.js`'s own precedent -- not nested under Enroll/Reports;
tab div; script tag).
**Verification:** `node --check frontend/internal-alarms.js`.
**Pass:** Exit 0.
**Fail:** Syntax error.

**Status:** `[x]`
**Verification result:**
> Executed via `eng tools invoke executor codex.execute` (57,532
> tokens). Orchestrating session independently ran `node --check
> frontend/internal-alarms.js` — exit 0. New top-level sidebar entry
> "Internal Alarms" added to `frontend/index.html`, matching
> `relay-actions.js`'s own precedent exactly.

---

## Group 6 — Tests

### Task 6.1 — `test/test_internal_alarms.cpp` (new)
**Action:** New file, following the exact structure of
`test/test_relay_actions.cpp` (a `loggedInClient()` helper +
`FakeTransport` responder wiring). Cases:
- `getInternalAlarmSettings()`: full-flow mapping test (all 9 fields
  mapped correctly from a synthetic response using Task 1.1's
  confirmed numeric-type shape).
- Both `"0"`/`"1"` accepted for each boolean field (loop, matching
  `requireStringBoolField()`'s own existing test pattern in
  `test_system_information.cpp`).
- `setInternalAlarmSettings()`: capture the outgoing request body
  (matching `test_relay_actions.cpp`'s own `capturedBody` pattern) and
  assert every one of the 9 fields is present as a JSON *string* with
  the exact expected value.
- `setInternalAlarmSettings()` success path does not throw when the
  device returns a plain `200 {}` (or whatever Task 1.1/3.2 settled
  on as "success" -- match Task 3.2's own implementation exactly).
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; no regressions.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> Executed via `eng tools invoke executor codex.execute` (48,209
> tokens). Orchestrating session independently re-ran `cmake --build
> build --target amico_tests` — exit 0 (`ninja: no work to do`).
> `./build/amico_tests.exe` — 270 test cases, 1820 assertions, all
> passed, no regressions. All 4 planned cases added, including the
> exact-JSON-string-per-field regression check on the write path.

**Also add** `test/test_internal_alarms.cpp` to `CMakeLists.txt`'s
test source list (next to `test/test_relay_actions.cpp`).

---

### Task 6.2 — `test/backend/test_routes.cpp`
**Action:** Add route tests for `GET /internal-alarms` (mapping) and
`PUT /internal-alarms` (confirmation-header gate: without header ->
428; with header -> 200, following the exact pattern already in this
file for `PUT /users/:id/administrator`). Add both routes to the
"Every cookie gate rejects unauthorized requests" test's own `routes`
list (matching how `GET /relay-actions`/`POST /relay-actions/door-1/trigger`
were added for the Relay/Door actions plan).
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend_tests` — exit 0, clean
> build. `./build/amico_backend_tests.exe` — 99 test cases, 988
> assertions, all passed, no regressions. Added 3 new route tests plus
> 2 cookie-gate-rejection entries (`GET /internal-alarms`,
> `PUT /internal-alarms`).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:** Add `GET /internal-alarms` / `PUT /internal-alarms`
sections to `docs/backend-api.md` (matching the existing
`/relay-actions` section's own style, including a note that `PUT`
requires the confirmation header). Update `docs/api-roadmap.md`'s
"Discovery pending" table (the row listing "Internal Alarms
(`alarmint.html`)") to a new numbered section marked ✅ implemented,
following the exact style of section 12 (Relay / Door actions) --
include the captured `get_configuration.fcgi`/`set_configuration.fcgi`
evidence from spec.md Background, and Task 1.1's own live-confirmed
numeric-type finding.
**Verification:** Manual review (docs-only change, no build step).
**Pass:** Both files updated consistently with the shipped behavior.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> Executed via `eng tools invoke executor codex.execute` (62,562
> tokens, correctly stayed within `write_scope` this time). Manual
> review: `docs/backend-api.md` got new `GET`/`PUT /internal-alarms`
> sections; `docs/api-roadmap.md` got a new section 13 (marked 📋, not
> ✅, since Group 8 hasn't run yet -- correctly avoided the
> retroactive-completion mistake) and had its "Discovery pending" row
> removed. Section 13 will be updated to ✅ once Group 8 completes.

---

## Group 8 — Manual live verification (READ + one real WRITE, with restore)

### Task 8.1 — Read-only: form matches device state
**Action:** Obtain `APPROVE_LIVE_DEVICE_TEST:2026-09-16-internal-alarms-settings`
(a fresh one if the session/context has changed since Task 1.1). Log
into the real device via our own frontend, open the new "Internal
Alarms" section, confirm all 9 fields display values matching a direct
`get_configuration.fcgi` query. **Record these original values
somewhere durable for Task 8.2 to restore** (e.g. in this task's own
result below) -- do not lose them.
**Verification:** Manual, via chrome-devtools-mcp (or report back to a
human if browser access is unavailable -- see this file's own header
note).
**Pass:** All fields match; no console error; original values
recorded.
**Fail:** Mismatch, console error, or no browser access (stop, report).

**Status:** `[x]`
**Verification result:**
> 2026-09-17 — Read-only verification performed through the project's
> frontend with Chrome DevTools MCP. The app showed `Connected to
> http://192.168.2.156`; opening **Internal Alarms** issued `GET
> /internal-alarms` and received HTTP 200. The authenticated backend
> route performs the direct `get_configuration.fcgi` read. The response
> was:
> `{"deviceViolationEnabled":true,"doorSensorAlarmTimeoutAfterClosure":0,"doorSensorDelay":10,"doorSensorEnabled":true,"forcedAccessDebounce":0,"forcedAccessEnabled":true,"panicCardEnabled":false,"panicFingerDelay":120,"panicFingerEnabled":true}`
> The form displayed exactly the same nine values: door sensor enabled
> `true`, delay `10`, timeout after closure `0`, forced access enabled
> `true`, debounce `0`, device violation enabled `true`, panic finger
> enabled `true`, panic card enabled `false`, panic finger delay `120`.
> Original values are recorded here for any separately approved restore
> test. No Save button or write endpoint was invoked. The browser console
> contained only unrelated existing image 400s and form-id warnings; no
> Internal Alarms request or script error occurred.
> Related regression tests rerun afterward: `amico_tests.exe` — 270 test
> cases, 1820 assertions, all passed; `amico_backend_tests.exe` — 99 test
> cases, 988 assertions, all passed.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 8.2 — WRITE: change one field live, verify, then restore exactly
**Action:** **Before running**, obtain **both**:
1. `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-internal-alarms-settings`.
2. A separate, explicit "yes, save it now" message from a human, sent
   immediately before this specific save -- matching the extra safety
   step this project used for the Relay/Door actions plan's own
   physical-trigger test (`.plans/2026-09-16-relay-door-actions/tasks.md`
   Task 8.2). Tell the human plainly which field you're about to
   change and to what value before asking.

Then: pick the **lowest-consequence field to toggle** (prefer a
numeric delay/debounce/timeout value over disabling a boolean
security toggle -- e.g. change `door_sensor_delay` by a small amount
rather than flipping `panic_finger_enabled` off) and change it via the
Save button. Observe the actual `set_configuration.fcgi` response
(via the backend's own logs or by adding temporary instrumentation if
needed) and record its real shape in `DECISION_LOG.md` -- this project
has never captured this before. **Then immediately change it back to
its original value from Task 8.1 and Save again**, confirming the
device returns to its starting state.
**Verification:** Manual, via chrome-devtools-mcp; capture the raw
response body from the first (test) save.
**Pass:** Save succeeds, response shape recorded, field successfully
restored to its original value afterward, no console error.
**Fail:** Any regression, unexplained error, or failure to restore the
original value (escalate to a human immediately if restore fails --
do not leave the device in a changed security-settings state).

**Status:** `[x]`
**Verification result:**
> 2026-09-17 — With the separately approved live-write token and
> immediate explicit confirmation, changed only `door_sensor_delay`
> from its original `10` to `11`. The first `PUT /internal-alarms`
> returned HTTP 200 with response body `{"success":true}`. Its request
> body contained all 9 fields, with `doorSensorDelay: 11` and every
> other field unchanged.
> The value was immediately restored to `10`; the second PUT also
> returned HTTP 200 with `{"success":true}`. A fresh GET then confirmed
> the complete original state: enabled booleans
> `doorSensorEnabled=true`, `forcedAccessEnabled=true`,
> `deviceViolationEnabled=true`, `panicFingerEnabled=true`,
> `panicCardEnabled=false`; numeric values
> `doorSensorDelay=10`, `doorSensorAlarmTimeoutAfterClosure=0`,
> `forcedAccessDebounce=0`, `panicFingerDelay=120`.
> No other field was changed and no write was attempted after restore.
> The raw first-write response is recorded in `DECISION_LOG.md`.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 and 8.2 complete, original values confirmed restored
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are additive modifications to existing,
already-working files, plus 2 new files
(`frontend/internal-alarms.js`, `test/test_internal_alarms.cpp`).
Revert via `git diff`/`git checkout --` against this plan's own
changes if needed (check `git status` first per standing safety
practice). Task 8.2's own live write is restored in-place by the task
itself, not via git.
