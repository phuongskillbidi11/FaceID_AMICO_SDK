# Spec — Internal Alarms (Settings, read + write)

---

## Goal

Add read + write support for the device's Settings → "Internal
Alarms" page (`alarmint.html`), closing `docs/api-roadmap.md`'s
"Discovery pending" row for it. This is this project's **first
`set_configuration.fcgi` write** — every prior settings-style plan
(Date and Time, License Mode) deliberately deferred its own write
side; this one implements both sides in one pass because the device
itself only ever exposes this as a single combined settings form (no
separate read-only sub-view exists to ship alone).

**Done looks like:** `AmicoClient::getInternalAlarmSettings()` reads
the current settings; `AmicoClient::setInternalAlarmSettings(...)`
writes all of them in one call (full-replace, matching the device's
own Save button, which always sends every field together — there is
no partial-update affordance in the real UI); `GET`/`PUT
/internal-alarms` expose both; a Settings-style form on the frontend.

**IMPORTANT — this plan is written for hand-off to the Codex CLI
executor backend**, per this session's own established pattern
(`eng tools invoke executor codex.execute <plan-dir> "<task>"` per
task, per `core/executor/METHOD.md`). The Planner (this session) does
**not** implement any part of this plan — see "Execution model" below.

---

## Background — evidence (2026-09-16)

**Static read** of the device's own `en_US/js/pages/alarm_int.js`
(the page-specific script for `alarmint.html`; an unauthenticated GET
of a static asset — no live-device call, no approval needed):

```
POST /get_configuration.fcgi {"alarm":[
  "door_sensor_enabled", "door_sensor_delay",
  "door_sensor_alarm_timeout_after_closure",
  "forced_access_enabled", "forced_access_debounce",
  "device_violation_enabled",
  "panic_finger_enabled", "panic_card_enabled", "panic_finger_delay"
]}
```

The Save button sends everything back in one shot via a device call
**this project has never used before**:
```
POST /set_configuration.fcgi {"alarm": {
  "door_sensor_enabled": "0"|"1",
  "door_sensor_delay": "<raw .val() string>",
  "door_sensor_alarm_timeout_after_closure": "<raw .val() string>",
  "forced_access_enabled": "0"|"1",
  "forced_access_debounce": "<raw .val() string>",
  "device_violation_enabled": "0"|"1",
  "panic_finger_enabled": "0"|"1",
  "panic_card_enabled": "0"|"1",
  "panic_finger_delay": "<raw .val() string>"
}}
```

Field semantics, read from the page's own labels/validation:
- `door_sensor_enabled`/`forced_access_enabled`/
  `device_violation_enabled`/`panic_finger_enabled`/
  `panic_card_enabled` — on/off toggles. On write, the JS sends the
  literal strings `"0"`/`"1"` (not real JSON booleans) — matches the
  already-known third boolean-ish convention this project has a
  helper for (`requireStringBoolField()`, added for the Date and Time
  plan).
- `door_sensor_delay`, `door_sensor_alarm_timeout_after_closure`,
  `forced_access_debounce`, `panic_finger_delay` — numeric
  text-input fields (seconds, per their labels), validated client-side
  as `ValidateUtil.isNumber(...)`; `forced_access_debounce`
  additionally validated as a non-negative integer
  (`Number.isInteger(parseFloat(...))`, `>= 0`).

**Not yet confirmed (genuine gap, left for the executor to resolve
live — see "Execution model" below)**: whether `get_configuration.fcgi`
returns these numeric fields as JSON numbers or JSON number-strings.
The write path is confirmed to always send raw strings (the JS never
converts `.val()`'s string output), but the *read* shape was not
captured in this static-only pass. This project has already seen both
conventions elsewhere (`relay_count` as a JSON string of an integer in
the Relay/Door actions plan; real JSON numbers for
`system_information.fcgi`'s `license.users`/etc.) — do not assume
either without a live read.

**A likely device-side bug, noted but not replicated**: the page's own
Save handler checks `if ('error' in data)` where `data` is the
*original* `get_configuration.fcgi` response captured at page load,
not `result` (the actual `set_configuration.fcgi` response) — almost
certainly a copy-paste bug in the device's own JS. This plan's own
implementation must check the real `set_configuration.fcgi` response
for an error indicator, not replicate this apparent bug.

---

## Execution model — Codex CLI hand-off (this session's own choice, 2026-09-16)

Unlike every prior plan this session, **the Planner does not
implement this plan**. Per the user's own explicit direction: write
the plan, get it approved, then hand every group — including Group 8's
own live verification — to the Codex CLI executor backend
(`eng tools invoke executor codex.execute <plan-dir> "<task text>"`,
per `core/executor/METHOD.md`).

**Known, disclosed uncertainty**: `core/executor/METHOD.md`'s own
documented Codex integration is scoped to *file edits* per task — it
says nothing about MCP tool access (e.g. `chrome-devtools-mcp`) inside
a `codex.execute` invocation. This project's chrome-devtools-mcp
access has, for every prior plan, been wired into *this* Claude Code
session specifically. **Whether the user's local Codex CLI
installation has its own chrome-devtools-mcp (or equivalent browser
automation) configured is unknown to the Planner** — this plan's own
Group 8 tasks are written assuming the executor *can* drive a browser,
with an explicit fallback instruction (stop and report back to a human
if it cannot) rather than silently skipping live verification.

Tasks below are written more prescriptively than this project's usual
style specifically because of this hand-off — Codex has no
conversation history with the Planner's own reasoning, so each task
spells out the exact device call, exact field list, and exact
uncertainty to resolve live, rather than referring back to prior
plans' own established idioms by name only.

---

## Design decisions

### Decision 1 — Read + write in one plan, unlike every prior settings plan
- **Chosen:** Both `GET /internal-alarms` and `PUT /internal-alarms`
  ship together.
- **Why:** Date and Time and License Mode each deferred their write
  side because the device exposes *separate* read-only surfaces
  (`system_information.fcgi`'s own fields) independent of any
  editable form. Internal Alarms has no such split — the device's
  only interface to this data is one combined get/set settings form,
  so a read-only-first slice would ship a page that can display
  current settings but never explains how they'd ever be changed,
  which is a worse initial slice than doing both together here.
- **Rejected alternatives:** Read-only first, defer write to a later
  plan (the Date and Time/License Mode precedent) — rejected
  specifically because of the above; matching a precedent that doesn't
  fit this device's own actual surface would be a worse design than
  deviating from it here.

### Decision 2 — Full-replace write, not a partial-update `...Update` type
- **Chosen:** `setInternalAlarmSettings(const InternalAlarmSettings&)`
  takes the complete settings struct and always sends every field
  (matching the device's own Save button, which never sends a
  partial set).
- **Why:** The device's own JS provides no partial-update affordance
  — every field is read on page load and re-sent as a whole on Save.
  Inventing a partial-update path this project has no evidence the
  device supports would be exactly the kind of unevidenced write this
  project has never done.
- **Rejected alternatives:** A `...Update` struct with optional
  fields (this project's usual CRUD convention for `users`/`groups`/
  etc.) — rejected; those objects are individually addressable rows
  with confirmed partial-update support (`PATCH` semantics
  LIVE_CONFIRMED per-object), which is not the situation here.

### Decision 3 — `X-Confirm-Sensitive-Action` required on the write route
- **Chosen:** `PUT /internal-alarms` requires the standard
  confirmation header, same bar as `setPassword`/`setAdministrator`/
  Operation Mode-style device-wide settings changes.
- **Why:** These are security-relevant settings (door sensor alarm,
  forced-access detection, panic buttons) — silently disabling one has
  real security consequences, a meaningfully different risk profile
  from `feedback_write_api_risk_tiers.md`'s own "relay/turnstile/LED"
  exemption (a momentary physical pulse, not a persistent
  security-posture change).
- **Rejected alternatives:** No confirmation header (matching the
  relay/turnstile exemption) — rejected; this is a configuration
  change with a lasting effect, not a momentary action, so it does not
  fit that exemption's own stated reasoning.

### Decision 4 — Executor must confirm the read shape live before trusting a parsing approach
- **Chosen:** Group 1's own first task requires a live read (gated by
  a read-only approval token) to observe whether the 4 numeric fields
  come back as JSON numbers or JSON number-strings, *before* writing
  the `InternalAlarmSettings` struct's field types.
- **Why:** Background already flags this as unconfirmed by the
  static-only pass. This project's own standing rule (never guess a
  wire shape) applies regardless of who — Planner or Codex — is doing
  the implementing.
- **Rejected alternatives:** Guessing "probably JSON numbers, like
  most other numeric fields" — rejected; this project has already been
  wrong about a similar guess before (`relay_count` turned out to be a
  JSON string).

---

## Scope

### In scope
- SDK: `InternalAlarmSettings` struct;
  `AmicoClient::getInternalAlarmSettings()`;
  `AmicoClient::setInternalAlarmSettings(const InternalAlarmSettings&)`.
- Backend: `GET /internal-alarms`; `PUT /internal-alarms` (with
  `X-Confirm-Sensitive-Action`).
- Frontend: a new "Internal Alarms" sidebar section (new top-level
  entry, matching Relay/Door Actions' own precedent — this is a
  distinct feature area, not an addition to System Information) with
  toggle switches + numeric inputs + a Save button.
- Tests: SDK-level read/write mapping tests (including the
  string-boolean and confirmed numeric-type parsing), backend route
  tests (including the confirmation-header gate).
- Docs: `docs/backend-api.md` new `/internal-alarms` section;
  `docs/api-roadmap.md`'s "Discovery pending" table row updated.

### Out of scope
- **Any other Settings tile** — this plan is scoped to exactly the one
  page discovered (Background).
- **Replicating the device's own apparent `if ('error' in data)` bug**
  — Background's own note; the real `set_configuration.fcgi` response
  must be checked instead.
- **A partial-update (`PATCH`) path** — spec.md Decision 2.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `InternalAlarmSettings` struct |
| `include/amico/Client.hpp` | Modify | `getInternalAlarmSettings()`/`setInternalAlarmSettings()` + `...Impl` declarations |
| `src/Client.cpp` | Modify | Implementation |
| `backend/JsonMapping.cpp` / `.hpp` | Modify | `toJson(InternalAlarmSettings)`, `fromJsonInternalAlarmSettings(...)` |
| `backend/Routes.cpp` | Modify | `GET /internal-alarms`, `PUT /internal-alarms` |
| `frontend/internal-alarms.js` | New | New sidebar section, form with toggles/numeric inputs/Save |
| `frontend/index.html` | Modify | New sidebar entry + tab div + script tag |
| `test/test_internal_alarms.cpp` | New | SDK-level tests |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `docs/backend-api.md` | Modify | New `/internal-alarms` section |
| `docs/api-roadmap.md` | Modify | "Discovery pending" table row updated to ✅ |

---

## Risks and unknowns

- **Numeric field JSON type unconfirmed** — Decision 4's own live
  check resolves this before Group 1 finishes.
- **First-ever `set_configuration.fcgi` write** — no prior plan's
  precedent to lean on for response-shape assumptions; Group 8's live
  write test is this plan's only chance to observe a real success/
  error response.
- **Codex/chrome-devtools-mcp uncertainty** — "Execution model" above;
  Group 8 tasks include an explicit stop-and-report fallback.
- **Security-relevant settings** — Decision 3's confirmation-header
  requirement is the primary mitigation; Group 8's live write test
  should restore the original values afterward (read them first in
  Task 8.1, write them back unchanged in place of any test write
  wherever possible) rather than leaving the device in a different
  security posture than it started in.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 8/10 | Request/write shapes and field semantics captured; read-side numeric type explicitly flagged unconfirmed rather than guessed |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 3 items, each with a clear reason |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 11 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | Read+write bundled by necessity (Decision 1), a deliberate deviation from this session's own precedent, clearly justified |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user chose "Internal Alarms"
as the next item, explicitly to be handed to the Codex CLI executor
backend for implementation and live verification.
**Confirmed on:** 2026-09-16
