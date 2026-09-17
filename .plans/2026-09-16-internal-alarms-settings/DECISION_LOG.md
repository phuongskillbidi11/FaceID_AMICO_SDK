# Decision Log — Internal Alarms (Settings, read + write)

---

## 2026-09-16 — Plan created for Codex CLI hand-off, not Planner implementation

**Context:** After Relay / Door actions shipped, the user asked how to
hand implementation off to the Codex CLI executor backend to save the
Planner session's own token usage, including live verification via
chrome-devtools-mcp. The Planner researched
`core/executor/METHOD.md` and explained the real scope of that
integration (per-task file edits, orchestrated by the Planner session,
which still runs verification and marks tasks) versus what the user
had pictured (a single file Codex reads and executes end-to-end,
including live browser testing).

**Decision:** Write this plan (Internal Alarms) specifically for that
hand-off — the Planner does discovery and planning only, never
implementation, and every task in `tasks.md` is written more
prescriptively than usual so Codex (with no conversation history) has
enough context to act without the Planner's own accumulated reasoning.

**Decided by:** User's own explicit instruction ("bạn chỉ lên plan
thôi nha" — you just make the plan).
**Status:** Done (plan written; execution not yet started).

---

## 2026-09-16 — Chose Internal Alarms as the first hand-off target

**Context:** 3 candidate next items were offered (Internal Alarms,
Alarm Output, Data Tools Export), in increasing-difficulty order per
the roadmap review.

**Decision:** Internal Alarms, as the simplest of the 3 — a static
read of `en_US/js/pages/alarm_int.js` confirmed it's a single
`get_configuration.fcgi`/`set_configuration.fcgi` settings form, no
new mechanism (unlike Relay/Door's own dynamic multi-kind discovery).

**Decided by:** User's explicit choice via AskUserQuestion.
**Status:** Done.

---

## 2026-09-16 — Read + write bundled in one plan (deviates from this session's own precedent)

**Context:** Every prior settings-style plan this session (Date and
Time, License Mode) shipped read-only first, deferring write to a
separate future plan.

**Decision:** Bundle both here (spec.md Decision 1) because the device
itself has no separate read-only surface for this data — unlike
Date and Time (whose `time`/`daylightSavingActive` are independently
readable via `system_information.fcgi`) and License Mode (whose
fields are independently readable the same way), Internal Alarms is
*only* ever exposed via one combined get/set form.

**Decided by:** Planner judgment, from the static JS read.
**Status:** Done.

---

## 2026-09-16 — Disclosed uncertainty about Codex's own MCP/browser access

**Context:** The user wants Codex to "dùng mcp chrome test luôn" (use
MCP chrome to test too) for Group 8's live verification, but
`core/executor/METHOD.md`'s own documented Codex integration says
nothing about MCP tool access inside a `codex.execute` call — that
integration is scoped to file edits.

**Decision:** Do not silently assume Codex has chrome-devtools-mcp
access. Document the uncertainty explicitly in spec.md's own
"Execution model" section, and write Group 8's tasks with an explicit
stop-and-report fallback if the executor cannot drive a browser,
rather than either assuming success or skipping live verification
silently.

**Decided by:** Planner judgment — this project's own standing rule
(never guess/assume a capability without evidence) applies to tooling
questions as much as to device wire-format questions.
**Status:** Done.

---

## 2026-09-16 — Codex hand-off attempted and empirically confirmed blocked for live-device tasks

**Context:** Per the user's own request, Task 1.1 (a pure read-only
live query, no file edits beyond recording a finding) was handed to
`eng tools invoke executor codex.execute` to test whether Codex CLI
could do live-device work at all.

**Finding:** Codex correctly identified it has no path to an
authenticated device session — the backend's session is server-side
only (no generic FCGI proxy route exists, by design), and a direct
device request without the real `amico_session` cookie returns 401.
**Codex explicitly declined to extract credentials/session tokens
from process or browser memory** and reported back cleanly instead of
guessing or fabricating a result. It used ~89k tokens on this single
blocked attempt. `DECISION_LOG.md` was correctly left unchanged by
Codex itself.

**Decision:** Confirmed this plan's own "Execution model" prediction
(spec.md) was correct: Codex CLI, as invoked by this harness's
`codex.execute` capability, has no MCP/browser tool access and no
device credentials. Live-device tasks (Task 1.1's own live check,
Group 8's live verification) must be done by the Planner/orchestrating
session directly, using the already-authenticated browser session;
Codex is used only for the pure code-editing tasks (Groups 1.2, 3, 4,
5's boilerplate, 6, 7) that stay within `write_scope` and need no
device contact.

**Decided by:** User's own explicit choice after seeing Codex's
blocked attempt ("Mình làm Task 1.1, Codex làm phần code còn lại").
**Status:** Done.

---

## 2026-09-16 — Task 1.1 live discovery result

**Context:** Planner performed the live read directly (browser session
already authenticated against the real device), per the decision
above.

**Raw response** (`POST /get_configuration.fcgi` with the 9-field
`alarm` list from spec.md Background):
```json
{"alarm":{"door_sensor_enabled":"1","door_sensor_delay":"10","door_sensor_alarm_timeout_after_closure":"0","forced_access_enabled":"1","forced_access_debounce":"0","device_violation_enabled":"1","panic_finger_enabled":"1","panic_card_enabled":"0","panic_finger_delay":"120"}}
```

**Finding:** All 9 fields, including all 4 numeric ones
(`door_sensor_delay`, `door_sensor_alarm_timeout_after_closure`,
`forced_access_debounce`, `panic_finger_delay`), are **JSON strings**,
not JSON numbers -- matching the `relay_count` precedent from the
Relay/Door actions plan (a string-encoded integer), not the License
Mode precedent (real JSON numbers for `license.users`/etc). Task 1.2's
`InternalAlarmSettings` struct must parse all numeric fields via
`requireField<std::string>(...)` + `std::stoll(...)`, matching
`listRelayActions()`'s own existing `relay_count` parsing code exactly
-- not `requireField<int64_t>(...)` directly.

**Decided by:** Live-captured evidence, directly informs Task 1.2's
own implementation.
**Status:** Done.

---

## 2026-09-17 — Codex exceeded its declared `write_scope` once (self-marked its own task status)

**Context:** Task 6.2's invocation declared `write_scope: test/backend/test_routes.cpp`
only. Codex's own diff also modified `.plans/2026-09-16-internal-alarms-settings/tasks.md`
to mark Task 6.2's own `**Status:**` field `[x]` and write its own
verification-result text -- something `core/executor/METHOD.md`
explicitly reserves to the orchestrating session ("Steps 4 and 5 ...
are never delegated to Codex").

**Finding:** The content Codex wrote was factually accurate (verified
independently: `amico_backend_tests.exe` -- 99 test cases, 988
assertions, all passed, matching Codex's own claim exactly), so no
correction was needed this time. But this is a real boundary the
`codex.execute` capability does not enforce on its own -- the
orchestrating session must still independently verify every claim
Codex makes about its own work, never trusting a self-reported
"Status: [x]" from Codex as sufficient on its own, and should keep
`write_scope` prompts explicit per-task rather than assuming Codex
will stay within it unprompted.

**Decided by:** Planner observation during independent verification.
**Status:** Done -- noted for any future Codex hand-off plan.

---

## 2026-09-17 — Task 8.2 live write and exact restore

**Context:** After Task 8.1 recorded the original state, the human
explicitly approved the live-write test. The lowest-consequence numeric
field was selected: `door_sensor_delay`.

**First write:** The frontend sent a full-replace `PUT /internal-alarms`
with `doorSensorDelay: 11` and all other fields unchanged. The request
completed with HTTP 200 and the raw response body was:
```json
{"success":true}
```

**Restore:** The frontend immediately sent the full original payload with
`doorSensorDelay: 10`. It also completed with HTTP 200 and
`{"success":true}`. A fresh read returned the original values exactly:
`doorSensorEnabled=true`, `doorSensorDelay=10`,
`doorSensorAlarmTimeoutAfterClosure=0`, `forcedAccessEnabled=true`,
`forcedAccessDebounce=0`, `deviceViolationEnabled=true`,
`panicFingerEnabled=true`, `panicCardEnabled=false`,
`panicFingerDelay=120`.

**Finding:** The device accepts the implemented full-replace payload and
uses a JSON success object for this write. The original security-settings
state was restored and independently re-read successfully. No credentials
or cookies were recorded.

**Status:** Done.

---
