# Spec — Date and Time settings (read-only)

---

## Goal

Add a read-only `GET /settings/date-time` endpoint, closing the
read-only half of `docs/api-roadmap.md` section 9. This is a small,
low-risk plan: a single combined read across 3 already-evidenced
device calls, no new object-query builders, no write path.

**Done looks like:** `AmicoClient::getDateTimeSettings()` returns one
struct combining the device's current time, DST state, NTP
enabled/timezone, clock/date display format, and configured NTP
servers; a new `GET /settings/date-time` backend route exposes it as
JSON.

---

## Background — live evidence (2026-09-16)

`LIVE_CONFIRMED` via a gated read-only discovery pass
(`APPROVE_LIVE_DEVICE_TEST:2026-09-16-date-time-discovery`,
user-approved verbatim). The 3 calls' own *request* shapes were
already known from the Giai đoạn 0+1 48-command pass; this pass
captured their *response* shapes for the first time:

```
POST /get_configuration.fcgi {"ntp":["enabled","timezone"]}
  -> {"ntp":{"enabled":"0","timezone":"UTC+7"}}

POST /get_configuration.fcgi {"general":["clock_12h_format","month_day_year_format"]}
  -> {"general":{"clock_12h_format":"0","month_day_year_format":"0"}}

POST /get_ntp_server.fcgi {}
  -> {"server1":"vn.pool.ntp.org","server2":"pool.ntp.org"}
```

**Notable finding**: `enabled`/`clock_12h_format`/`month_day_year_format`
are **JSON strings** `"0"`/`"1"`, not JSON booleans or 0/1 integers —
a third boolean-ish convention this project has now seen (after plain
JSON `true`/`false` and 0/1-integer, e.g. `hol1`/`hol2`/`hol3`). Needs
its own parsing helper, not the existing `requireBoolLikeField()`
(which only handles the first two).

The device's own current time/DST state is **already exposed** via
the existing `system_information.fcgi` response (`"time"`, epoch
seconds; `"daylight_savings_time_active"`, a real JSON boolean) —
confirmed still present in a live re-check this pass
(`{"time":1789570661,"daylight_savings_time_active":false,...}`).
These are **not yet mapped** into this SDK's own `SystemInformation`
struct (`include/amico/Types.hpp` — only `serial`/`firmwareVersion`/
`secboxVersion`/`deviceName`/`deviceId`/`online`/`network` are
currently exposed), and adding them there would conflate "device
identity" with "date/time settings," two different concerns. This
plan instead re-fetches `system_information.fcgi` as part of its own
combined read and exposes `time`/`daylightSavingActive` on a new,
dedicated `DateTimeSettings` struct.

**Write side genuinely out of scope for this plan**: `set_system_time`/
`set_ntp_server`/`get_ntp_server_status` were already
`UI_HANDLER_CONFIRMED` (command names known) in an earlier pass, but
their exact payload shapes were never captured — `docs/api-roadmap.md`
section 9 already flags this needs its own confirm pass and likely
belongs in the same risk tier as License Mode (both change device-wide
behavior). Not attempted here.

---

## Design decisions

### Decision 1 — Read-only; no write path in this plan
- **Chosen:** Only `GET /settings/date-time` is implemented.
  `PUT /settings/date-time` (`set_system_time`/`set_ntp_server`) is
  explicitly deferred to a future plan.
- **Why:** The write commands' exact payload shapes were never
  captured (spec.md Background), and changing device-wide date/time
  behavior is a materially higher-risk operation than any read this
  session has done — matching `feedback_write_api_risk_tiers.md`'s own
  "credential/firmware-adjacent write" tier, which this project treats
  with extra care (per-attempt confirmation, not a routine CRUD
  write). Attempting it without a captured payload shape would mean
  guessing at a device-wide time-change operation, which this project
  never does.
- **Rejected alternatives:** Guessing the write payload shape from the
  read shape's own field names — rejected; this project only
  implements a write path once its exact shape is captured or a
  dedicated confirm pass is run, never by inference alone for a
  higher-risk operation.

### Decision 2 — A dedicated `DateTimeSettings` struct, not extending `SystemInformation`
- **Chosen:** New `DateTimeSettings` struct with its own `time`/
  `daylightSavingActive` members (re-fetched from
  `system_information.fcgi` as part of this read), rather than adding
  those two fields to the existing `SystemInformation` struct.
- **Why:** `SystemInformation` represents device *identity* (serial,
  firmware, network) — a different concern from date/time *settings*.
  Conflating them would mean every `SystemInformation` read either
  always re-fetches time-related fields it doesn't need, or the struct
  grows fields unrelated to its own existing purpose.
- **Rejected alternatives:** Extending `SystemInformation` — rejected
  as scope creep on an already-shipped, unrelated type.

### Decision 3 — A new string-boolean parsing helper, not reusing `requireBoolLikeField()`
- **Chosen:** A new helper (e.g. `requireStringBoolField()`) that reads
  a JSON string field and returns `true`/`false` for `"1"`/`"0"`,
  throwing `ProtocolError` for any other value.
- **Why:** `requireBoolLikeField()` (used for `hol1`/`hol2`/`time_spans`
  weekday flags/etc.) only accepts a real JSON boolean or a 0/1
  integer — it would throw on this endpoint's own JSON-string
  convention. This is a genuinely different wire convention, not a
  variant of the existing one.
- **Rejected alternatives:** Widening `requireBoolLikeField()` itself
  to also accept strings — rejected; silently accepting a third
  format in a function whose whole purpose is validating exact
  expected shapes would make it harder to reason about what any given
  caller actually expects back.

### Decision 4 — No new `ObjectQuery.cpp` builders
- **Chosen:** The 3 request bodies are constructed directly in
  `src/Client.cpp`, not via `src/ObjectQuery.hpp/.cpp`.
- **Why:** `ObjectQuery.cpp`'s builders exist specifically for the
  generic `load_objects.fcgi`/`create_objects.fcgi`/etc. family, where
  caller-supplied object/field/where values create a real
  whitelisting concern. `get_configuration.fcgi`/`get_ntp_server.fcgi`
  take a fixed, hardcoded set of keys with zero caller-supplied
  variability — the same precedent already established for
  `system_information.fcgi` itself, which also has no `ObjectQuery`
  builder and no whitelist test.
- **Rejected alternatives:** Adding builders anyway "for consistency"
  — rejected; would add a testable-but-pointless indirection for
  bodies with no actual parameters.

---

## Scope

### In scope
- SDK: `DateTimeSettings` type; `AmicoClient::getDateTimeSettings()`
  (a direct method, matching the existing `getSystemInformation()`
  precedent — no new API class needed for a single combined read).
- Backend: `GET /settings/date-time`.
- Frontend: a read-only "Date and Time" tile/panel under Settings,
  matching the existing "About"/System Information display pattern.
- Tests: `AmicoClient::getDateTimeSettings()` behavior (all 3 calls'
  responses mapped correctly, including the string-boolean parsing),
  backend route test.
- Docs: `docs/backend-api.md` new `/settings/date-time` section;
  `docs/api-roadmap.md` section 9 updated to reflect the read side
  shipped.

### Out of scope
- **`PUT /settings/date-time`** (the write side) — spec.md Decision 1.
- **License Mode** — a related but separate Settings item
  (`docs/api-roadmap.md` section 8), not touched by this plan.
- **Extending `SystemInformation`** — spec.md Decision 2.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `DateTimeSettings` struct |
| `include/amico/Client.hpp` | Modify | `getDateTimeSettings()` method + `...Impl` declaration |
| `src/Client.cpp` | Modify | Implementation; new `requireStringBoolField()` helper |
| `backend/JsonMapping.cpp` | Modify | `toJson(DateTimeSettings)` |
| `backend/Routes.cpp` | Modify | `GET /settings/date-time` |
| `frontend/system-info.js` | Modify | Add a Date and Time panel (reuses the existing System Information tab, matching how "About" data is already displayed there) |
| `test/test_system_information.cpp` | Modify | `getDateTimeSettings()` tests (reuses the existing file, since this is conceptually a sibling read to `getSystemInformation()`) |
| `test/backend/test_routes.cpp` | Modify | New route test |
| `docs/backend-api.md` | Modify | New `/settings/date-time` section |
| `docs/api-roadmap.md` | Modify | Section 9 updated to reflect the read side shipped |

---

## Risks and unknowns

- **Low overall risk** — 3 already-evidenced reads, no writes, no new
  query-builder surface.
- **The string-boolean convention** is new to this codebase (Decision
  3) — confirmed directly from a live response this pass, not
  inferred.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 10/10 | All 3 response shapes directly captured this pass; nothing inferred |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 3 items listed, each with a clear reason; deliberately small scope |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 10 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 10/10 | No deferred risks — the smallest, most fully-evidenced plan this session |

**Total: 38/40 → 9.5/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user chose "Date and Time
(Settings, read-only)" via AskUserQuestion.
**Confirmed on:** 2026-09-16
