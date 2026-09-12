# Spec — Phase 2 (corrected): Read-only C++17 SDK for AMICO VL70LF

> This is the corrected replacement for
> `.plans/2026-09-11-implement-phase-2-production-oriented-re/spec.md`
> (that plan is `BLOCKED`, its three WIP header files are reviewed below,
> not assumed correct). Written after the P1/P2 discovery gate passed
> (`.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/spec.md`'s
> P4 section, verdict: PASS). **Per the parent plan's own P5 definition,
> this spec requires the user's explicit approval before `tasks.md` is
> written or Executor is activated — that approval has not been given
> yet; this document is presented for review, not self-approved.**

---

## Goal

Ship a buildable, testable C++17 client library (`AmicoClient`) covering
exactly the operations both discovery passes confirmed as read-only and
in-scope: login, session check, device info, list/get users, list access
logs, logout — using the real wire contracts (filters, pagination,
field-omission danger) confirmed in `docs/amico-endpoints.md` and
`docs/ui-action-protocol-map.md`, not the narrower Phase 1-only picture the
blocked plan was built on.

**Done looks like:** `cmake --build` produces `amico_sdk` (static lib),
`amico_tests` (all offline, all green, no network), and six example
binaries; a gated live-smoke-test binary exists but is not run by default;
`AmicoUser` never carries `password`, `salt`, `panic_password`, or
`panic_salt` even though the wire protocol would hand them over if asked;
no internal query ever omits `fields`.

---

## Background

Two discovery passes now inform this spec instead of one:

- **Phase 1** (dashboard-only): confirmed login/session/logout mechanics,
  `system_information.fcgi`, and a first look at `users`/`access_logs` via
  the dashboard's narrow queries.
- **P1/P2** (`.plans/2026-09-11-p1-read-only-browser-mcp-discovery-pass-`,
  `COMPLETED`): visited the actual Users/Groups/Time-Zones/Reports pages
  and statically read the Settings page's full command dispatcher. This
  found two things that change this spec versus the blocked one:
  1. The real Users-page default filter, search, and pagination contract
     (not just what the dashboard happened to request).
  2. **Omitting `fields` from a `load_objects.fcgi` query returns every
     column** — including two fields Phase 1 never saw, `panic_password`
     and `panic_salt`. This is now a hard design rule, not just a "drop
     these two fields" rule: **every internal query must always pass an
     explicit `fields` list.**

---

## Design decisions

### Decision 1 — Session cookie: `login` + `session`, not `session` alone
*(carried forward from the blocked plan, re-confirmed by P1 across a
longer multi-page session)*
- **Chosen:** Every authenticated request sends `Cookie: login=<username>; session=<token>`.
- **Why:** `docs/amico-auth-flow.md` and P1's re-check both show the real
  device requires both cookies together throughout a session.

### Decision 2 — Generic query engine stays internal; no public escape hatch
*(carried forward, now with much stronger justification)*
- **Chosen:** `load_objects.fcgi` is wrapped by a private `detail::ObjectQuery`
  builder. Public API exposes exactly two typed operations backed by it:
  users and access-logs. No object name, field name, or `where`/`connector`
  string is ever accepted from an SDK caller.
- **Why:** P1 found the device's real write-command surface is **~78
  operations** (`artifacts/live_capture/messenger_commands.json`), not the
  handful Phase 1 saw, and found that `load_objects.fcgi`'s `where` shape
  is inconsistent across objects (`reports`/`report_filters` use a nested
  object; everything else uses an array of clauses) and that a Users-page
  search box's raw text flows into a SQL `LIKE` pattern server-side. A
  public generic-query escape hatch would be a second, SDK-shaped
  injection/over-exposure surface layered on top of a device that already
  has a large one. Restricting to two hand-built, evidence-matched queries
  removes that risk entirely by construction.
- **Rejected alternatives:** Exposing `loadObjects(object, rawWhere)` —
  rejected for the same reason as before, now with concrete evidence
  (the SQL-`LIKE`-shaped search, the inconsistent `where` shapes) instead
  of just a theoretical concern.

### Decision 3 — Access-log range filtering: server-side upper bound + client-side lower bound
*(carried forward, unchanged — still no evidence of a working multi-clause
server-side range filter; P1's Reports-page capture used the same
single-upper-bound-plus-descending-order-plus-limit pattern Phase 1 saw,
not a two-sided range)*
- **Chosen:** `AccessLogQuery.to` becomes one server-side `where` clause
  (`time <= to`); `AccessLogQuery.from` filters the already-fetched page
  client-side.

### Decision 4 — Every internal query always passes an explicit `fields` list — new, hard rule
- **Chosen:** `detail::ObjectQuery` has no code path that can build a
  `load_objects.fcgi` body without a non-empty `fields` array. This is
  enforced structurally (the builder function's signature requires a
  non-empty field whitelist subset, not an optional one) rather than by
  convention/comment.
- **Why:** P1's single most important new finding. Confirmed live: a
  report-filter dropdown's `{"object":"users","order":["ascending","name"]}`
  query (no `fields` key at all) returned every column, including
  `panic_password`/`panic_salt`. Any future code path that "just wants the
  count" or "just wants one field" and skips specifying `fields` would
  silently leak every sensitive field over the wire into process memory
  even before redaction runs.
- **Rejected alternatives:** Relying on the redaction utility alone
  (Decision 4 assumes the sensitive value never leaves the wire response
  at all when it can be avoided) — rejected as insufficient defense in
  depth; redaction is still kept as a second, independent layer for
  logging/diagnostics (unchanged from the blocked plan), not a replacement
  for never requesting the field in the first place.

### Decision 5 — `UsersApi::get(id)` added: confirmed single-user lookup
- **Chosen:** Add `AmicoUser UsersApi::get(int64_t id)` alongside
  `list(UserQuery)`, both backed by the same internal query builder with a
  `where: [{field:"id", value:id}]` single clause (no `connector` needed —
  P1 confirmed a single-clause `where` needs no `connector` key at all).
- **Why:** This exact pattern (`where` filtered by `users.id`, single
  clause) is `LIVE_CONFIRMED` from Phase 1's dashboard user-card fetch
  *and* P1's per-row detail fetches — it is not new/invented, just newly
  worth exposing as its own typed method now that the parent spec's P5
  scope explicitly asks for "typed user detail if confirmed."
- **Rejected alternatives:** Not adding it (leave detail lookup to
  `list()` with a caller-built filter) — rejected because `list()`
  deliberately does not expose a filter parameter (Decision 6), so a
  distinct `get(id)` is the only protocol-faithful way to satisfy the
  parent spec's explicit ask.

### Decision 6 — `UsersApi::list()` keeps the confirmed default filter fixed, no caller-supplied filter/search/sort
- **Chosen:** `list(UserQuery)` always applies the exact confirmed default
  filter (`user_type_id = 0 OR user_type_id IS NULL`) and the confirmed
  default order (`name`, ascending). `UserQuery` carries only `limit` and
  `offset`, matching the task brief's original example exactly
  (`query.limit = 50; query.offset = 0;`). No search/sort parameter is
  added.
- **Why:** The brief's own example code never showed a search/sort field;
  P1 confirms search exists on the real UI but adding it now would be
  scope beyond what was asked, and no sort-by-column control was even
  found in the real UI (P4 gate item 8) — there is nothing to make a typed
  `sort` parameter faithful *to*.
- **Rejected alternatives:** Adding `UserQuery.search` since it's now
  confirmed — rejected as scope creep un-traceable to any acceptance
  criterion in the original brief; can be proposed as a Phase 3 addition
  if actually needed.

### Decision 7 — `face_templates`, `c_users`, `opening_times`, `groups`, `time_zones`, `reports` stay entirely out of the public API
- **Chosen:** None of the six additional objects P1 confirmed become part
  of this SDK's typed surface.
- **Why:** The parent spec's P5 scope list is explicit: login, session
  validation, system information, typed user listing/detail, typed
  access-log listing, logout. Nothing else. `face_templates` in particular
  must never be requested by this SDK at all — it's biometric data with
  no confirmed need in the stated scope, so the safest design is to never
  build a query capable of returning it, not to fetch-then-redact it.
- **Rejected alternatives:** Adding a `getUserPhoto`-style convenience
  now that the object's shape is known — rejected, not in the approved
  scope, and biometric data handling deserves its own dedicated review
  before any SDK method touches it.

### Decision 8 — Everything else carried forward unchanged from the blocked plan
Dependencies (vcpkg manifest: curl/nlohmann-json/doctest), transport
design (`IHttpTransport`/`CurlTransport`, redirects disabled, TLS-verify-
always, size caps), error taxonomy (10 types), redaction utility
(case-insensitive, recursive, now also covering `panic_password`/
`panic_salt` — see Scope), offline-test-via-`FakeTransport` approach, and
the gated live-smoke-test design are all unchanged from
`.plans/2026-09-11-implement-phase-2-production-oriented-re/spec.md` and
not repeated in full here — that document remains the design record for
those parts; this spec supersedes only the parts Decisions 1–7 above
change.

---

## Scope

### In scope
- `AmicoConfig` / `AmicoClient` per the original brief's example usage.
- `login()`, `isSessionValid()`, `getSystemInformation()`, `logout()`.
- `client.users().list(UserQuery{limit,offset})` → confirmed default-filtered,
  paginated `std::vector<AmicoUser>` (fields: `id,name,registration,
  user_type_id,begin_time,end_time,last_access` — never `password`,
  `salt`, `panic_password`, `panic_salt`).
- `client.users().get(int64_t id)` → single `AmicoUser` (new vs. the
  blocked plan — see Decision 5).
- `client.accessLogs().list(AccessLogQuery{from,to,limit})` → server-side
  upper bound + client-side lower bound (Decision 3, unchanged).
- Structured exception hierarchy (10 types, unchanged from the blocked plan).
- `IHttpTransport`/`CurlTransport` (unchanged design).
- Redaction utility, **extended** to also match `panic_password`/`panic_salt`
  (both already covered by the existing case-insensitive substring rule on
  `password`/`salt` — `panic_password` contains `password`, `panic_salt`
  contains `salt` — so no code change is needed there, just an explicit
  test case confirming it, since the rule was written before these two
  field names were known to exist).
- **New hard invariant, tested**: the internal query builder's function
  signature cannot compile a `load_objects.fcgi` body with an empty/absent
  `fields` list (Decision 4) — a dedicated offline test asserts this by
  trying to construct one and expecting a compile-time or constructor-time
  rejection, not just a runtime check.
- Offline tests (doctest), sanitized fixtures reflecting the *real*
  confirmed shapes (including a fixture proving the default-filter/order
  values), gated live smoke test, six examples (login, session-check,
  system-info, list-users, access-logs; **`get-user` example replaces
  nothing — it's a seventh example, since `get(id)` is new**), doc updates.

### Out of scope (explicitly excluded)
- `face_templates`, `c_users`, `opening_times`, `groups`, `time_zones`,
  `reports`/`report_filters` as public API — **reason:** Decision 7, not in
  approved scope, `face_templates` specifically is biometric data needing
  its own review.
- Search/sort parameters on `UserQuery` — **reason:** Decision 6, scope
  discipline; no sort control even exists in the real UI to be faithful to.
- The 78-command dispatcher, in any form — **reason:** Decision 2; this is
  precisely the surface this SDK exists to *not* re-expose.
- `import_objects.fcgi` and every other `UI_HANDLER_CONFIRMED`-only write
  operation — **reason:** never invoked, never confirmed on the wire,
  explicitly prohibited by both the original brief and common sense.
- `user_get_image.fcgi` — **reason:** carried forward from the blocked
  plan; ownership/IDOR behavior still not tested, still excluded.
- HTTPS live testing, async API — **reason:** carried forward, unchanged
  reasoning from the blocked plan.

---

## Affected files

Same file list as
`.plans/2026-09-11-implement-phase-2-production-oriented-re/spec.md`'s
Affected Files table, with these changes:

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Config.hpp` | **Review, likely modify** | Already exists as WIP from the blocked plan; must be re-checked against Decision 6's confirmed pagination-only `UserQuery` (no search/sort field) rather than assumed correct. |
| `include/amico/Errors.hpp`, `include/amico/Cancellation.hpp` | **Review, likely unchanged** | Protocol-agnostic; re-check for correctness but no scope-driven change expected. |
| `include/amico/Types.hpp` | Create | `AmicoUser` (whitelisted fields only, no password/salt/panic_* members), `AccessLogEntry`, `SystemInformation`, `UserQuery` (limit/offset only), `AccessLogQuery` (from/to/limit). |
| `include/amico/Client.hpp` | Create | `AmicoClient`, `UsersApi` (`list`, **`get`** — new), `AccessLogsApi` (`list`). |
| `src/ObjectQuery.hpp`/`.cpp` | Create | Internal whitelisted query builder; **structurally cannot omit `fields`** (Decision 4). |
| `src/Session.hpp`/`.cpp`, `src/JsonRedact.hpp`/`.cpp`, `src/UrlValidation.hpp`/`.cpp`, `src/http/HttpTransport.hpp`, `src/http/CurlTransport.hpp`/`.cpp`, `src/Client.cpp` | Create | Unchanged design from the blocked plan. |
| `test/fixtures/*.json` | Create | Now includes a fixture proving the confirmed default filter/order, and a fixture asserting `panic_password`/`panic_salt` redaction. |
| `test/*.cpp`, `test/main.cpp`, `test/live/live_smoke_test.cpp` | Create | 20+ scenarios from the blocked plan's list, plus: fields-never-omitted invariant test, `get(id)` test, panic-field redaction test. |
| `examples/*.cpp` (7 files) | Create | login, session-check, system-info, list-users, **get-user** (new), access-logs, logout. |
| `docs/sdk-usage.md`, `docs/src-map.md` | Create | Unchanged design from the blocked plan. |
| `vcpkg.json`, `CMakeLists.txt`, `.clang-tidy` | **Review, likely modify** | Already exist as WIP; `CMakeLists.txt` must add the seventh example target and any new test files once tasks.md enumerates them. |

---

## Risks and unknowns

- Same vcpkg-build-time risk as the blocked plan (curl built from source).
- `get(id)` for a nonexistent id: confirmed behavior is an empty
  `{"users":[]}` array (not a 404/error). **Resolved:** maps to an empty
  `std::optional<AmicoUser>` (user-confirmed), not a thrown error.
- Mid-session expiry signal shape remains unconfirmed (carried forward
  from the blocked plan).

---

## Open questions

- [x] `UsersApi::get(id)` return type for "not found": **resolved —
      `std::optional<AmicoUser>`** (user: "Approve, keep get(id) with
      std::optional<AmicoUser>").
- [x] Is `get(id)` wanted in this phase: **resolved — yes, keep it.**

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 10/10 | |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 6 out-of-scope items. |
| **Surgical Changes** | Every file listed with change type and exact reason | 10/10 | Delta table against the blocked plan's own table, explicit about what's new vs. reviewed-not-assumed. |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | `get(id)`'s return-type question is a genuine open decision, not yet traced to a firm criterion — flagged rather than silently decided. |

**Total: 39/40 → 9.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — "Approve, keep get(id) with
std::optional<AmicoUser>"
**Confirmed on:** 2026-09-11
