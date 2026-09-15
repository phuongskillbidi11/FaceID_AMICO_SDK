# Plan Review — Access (Global) report: full visual/functional parity

**Reviewer:** Claude (self-review; no separate plan-reviewer adapter
available this session — same precedent as the Visitors and Access
Logs plans).

## Pass 2 — Verdict: APPROVED

Both Pass 1 findings fixed:
- Finding 1: `spec.md`'s Decision 1 and `tasks.md`'s Task 3.1 now
  cover `GET /timezones` + `toJson(TimeZone)` alongside `GET /groups`;
  Task 5.3's wording no longer implies a pre-existing route.
- Finding 2: `spec.md`'s Goal now explicitly notes this plan
  supersedes the earlier Access Logs plan's deferral of these same
  filters/Export, by the user's fresh explicit decision this session.

No new issues found on re-review. Proceeding to execution.

---

## Pass 1 — Verdict: CHANGES REQUESTED (2 findings)

### Finding 1 (blocking) — Missing task: no `GET /timezones` backend route exists

Task 5.3 says "fetch ... `/timezones`-equivalent (check
`backend/Routes.cpp` for the existing route name backing
`TimeZonesApi` — reuse it, do not add a duplicate)". This is an
**incorrect assumption** — verified directly against
`backend/Routes.cpp`: no such route exists at all. The only existing
use of `TimeZonesApi` server-side is the specialized
`timeZoneNamesForAccessLogIds()` helper (a per-access-log id→name
lookup used internally by the `/access-logs` route), not a general
"list all time zones" HTTP endpoint. `backend/JsonMapping.cpp` also
has no `toJson(amico::TimeZone)` today. The SDK-level
`TimeZonesApi::list()` (`include/amico/Client.hpp`) does already
exist and is ready to use — only the HTTP route is missing.

**Required fix:** Task 3.1 must also add `GET /timezones` (returning
`{"timezones": [...]}`, same read-only-list pattern as the new `GET
/groups`) and `toJson(const amico::TimeZone&)`, alongside the
`Group`/`GroupsApi` work already planned. Task 5.3's wording should
stop implying the route already exists.

### Finding 2 (non-blocking) — Should cross-reference the Access Logs plan's earlier explicit deferral decision

The prior `2026-09-14-redesign-access-logs-frontend-and-backen` plan's
own visual-parity addendum explicitly deferred filter dropdowns and
Export at the user's own direction (recorded in that plan's own
`DECISION_LOG.md`/`spec.md`). This plan now implements exactly those
deferred items, per the user's fresh, explicit "làm hết tất cả (1-5)"
decision this session — not a contradiction, but `spec.md` should say
so explicitly (a future reader diffing the two plans' `DECISION_LOG.md`s
without this conversation's context could otherwise read this as an
unexplained reversal). Add one sentence to `spec.md`'s Background or a
Decision noting this supersedes that earlier deferral, by explicit
user request, dated this session.

## Checklist notes (non-issues, confirmed OK)

- **Missing requirements:** all 5 user-identified gaps are covered by
  Design Decisions 1-7 and the corresponding task groups.
- **Dependency problems:** task ordering is otherwise correct — Group
  3 (backend `/groups`, and after Finding 1's fix, `/timezones`) comes
  before Group 5 (frontend consumes both).
- **Security/hardware impact:** none — all new surface is read-only
  list/filter; no writes, no auth/secret handling.
- **Missing tests:** every task group with testable logic has a
  corresponding `tests.md` entry; Groups 4/5.1 (sidebar/breadcrumb, no
  logic) are correctly left to manual live verification only, matching
  the precedent set by the earlier Enroll-sidebar addendum.
