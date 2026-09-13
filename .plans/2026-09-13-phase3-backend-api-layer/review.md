# Plan Review — Giai đoạn 3: Backend API layer

**Reviewer role activated:** `eng adapter prompt plan-reviewer` (2026-09-13)

---

## Checklist

### Missing requirements
spec.md's Goal (thin HTTP/JSON proxy over the existing, already-tested
`AmicoClient` surface) matches exactly what the user asked for
("backend API layer riêng"), including the two technical guardrails
the user explicitly requested mid-negotiation. No gap.

### Incorrect assumptions
Verified against the actual codebase, not assumed:
- `amico_sdk`'s `target_include_directories(... PUBLIC
  $<BUILD_INTERFACE:.../include>)` (`CMakeLists.txt:26-31`) confirms
  `backend/main.cpp` can `#include "amico/Client.hpp"` etc. simply by
  linking `amico_sdk` — Task 1.6's plan to do exactly this is sound.
- Task 2.1's own text already correctly flags "do not guess the exact
  `cpp-httplib` ephemeral-port API, read the actual installed header
  first" — good discipline, not a gap.

### Architecture inconsistencies — **BLOCKING**
spec.md's Decision 6 (error mapping) and Task 1.3 build a complete
table mapping every `amico::AmicoError` subclass to an HTTP status —
but neither addresses what happens when the **incoming request body
itself** is malformed (e.g. `POST /users` with invalid JSON, or `POST
/users/:id/cards` with a non-numeric `areaCode`). `JsonMapping`'s
`fromJsonNewUser`/`fromJsonUserUpdate` (Task 1.2) would throw an
`nlohmann::json::exception` in that case — which is **not** an
`amico::AmicoError` subclass, so `ErrorMapping`'s table (Task 1.3) would
fall through to its generic "any other `std::exception` → 500" branch.

This is a real API-design defect, not a hypothetical: a caller who
sends malformed JSON (their own mistake) would receive `500 Internal
Server Error` — which conventionally signals "the server is broken,"
not "you sent something invalid." A client integrating against this
API (Giai đoạn 4's frontend) would reasonably interpret repeated 500s as
a backend bug and might retry, log alarms, or otherwise treat the
caller's own input error as a server incident.

**Required fix (Planner):** Add an explicit case to spec.md's Decision
6 table and Task 1.3: catch `nlohmann::json::exception` (and any other
request-body-parsing failure) separately, map it to `400 Bad Request`
with a body naming what was wrong, and add this as a distinct route
handler concern in Task 1.4/1.5 (parse the body in a try/catch that
returns 400 before ever reaching the `AmicoClient` call, so the
existing `AmicoError`-mapping table is only ever reached for problems
that occurred *after* the request was validly parsed). Add a
corresponding test case to Task 2.2/2.3 (malformed JSON body → 400,
not 500).

### Missing edge cases (tests.md)
Non-blocking, worth naming explicitly rather than leaving implicit:
- `PATCH /users/:id` with an empty JSON object (`{}`, no fields to
  change) — does this reach `UserUpdate` with both optional fields
  unset, and does the SDK's `update()` handle a no-op partial update
  gracefully, or does it need to be rejected at the route level before
  even calling the SDK? Recommend Task 2.2 add this as an explicit case
  (either behavior is acceptable, but it should be a deliberate,
  tested choice, not accidental).

### Missing tests
Covered once the malformed-JSON case above is added.

### Dependency problems
None — Task 0.1 correctly gates all backend code on `cpp-httplib`'s
vcpkg availability, and every later task depends on it appropriately.

### Security or hardware impact
Well handled: both technical guardrails (bind-address opt-in,
sensitive-action confirmation header) have dedicated, explicit test
tasks (2.3, 2.4) rather than being left to manual verification. The
plan is honest that neither is real authentication — stated plainly in
spec.md Decision 3 and required again in Task 3.1's docs. No live-write
test is attempted through the backend, consistent with not re-risking
the device for coverage the SDK's own live tests already provide.

---

## Verdict (pass 1): **CHANGES REQUESTED**

**Blocking:** Add explicit handling for malformed/invalid request-body
JSON (400 Bad Request), distinct from the `AmicoError`-mapping table
which should only ever see errors that occur after successful request
parsing. Everything else in the plan is sound.

**Non-blocking suggestion:** name the empty-`PATCH`-body case explicitly
in Task 2.2.

**Reviewed at:** 2026-09-13

---

## Re-review (pass 2) — 2026-09-13

Planner amended spec.md's Decision 6 with an explicit
request-body-parsing stage (separate from the `AmicoError` table,
returns 400/`InvalidRequest`, never reaches `AmicoClient`), updated
Task 1.3's scope note, Task 1.4/1.5's handler pattern (parse-then-call,
malformed input short-circuits to 400 before any SDK call), and Task
2.2 to test both the malformed-body case and the empty-`PATCH`-body
edge case from pass 1's non-blocking note. `tests.md`'s F-2 updated to
assert malformed bodies never fall through to 500.

Confirmed by direct read: the fix is structurally correct — request
parsing and `AmicoClient`-error mapping are now clearly two separate
stages in every affected task, not conflated. No new issues found on
re-review.

## Verdict (pass 2): **APPROVED**

**Reviewed at:** 2026-09-13
