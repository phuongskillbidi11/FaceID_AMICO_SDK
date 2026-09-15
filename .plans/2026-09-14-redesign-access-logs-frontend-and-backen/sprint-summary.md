# Sprint Summary — Redesign Access Logs to match the real device's "Access (Global)" report

**Date:** 2026-09-14
**State:** Complete. All tasks (Groups 1-5) `[x]`, all tests PASS.

## What shipped

The Access Logs tab now matches the real AMICO device's own
"Access (Global)" report column-for-column: 8 resolved columns (Date
and Time, Authorization, Identification, Id/Name/Employee ID (User),
Name (Portal), Name (Time Zone)) instead of the previous 6 raw
technical fields (`id, time, userId, portalId, logTypeId, event`) with
no joins. Added real pagination (10/20/30 per-page selector, Prev/
Next, "Showing X to Y of Z records") backed by a real server-side
`total` count.

## Key technical work

- **Backend does all joins/label computation in C++**, not the
  frontend — extended `AccessLogEntry` with `identifierId`; added
  minimal `PortalsApi`/`TimeZonesApi`/`UsersApi::getNamesByIds`; ported
  the real device's own `report.js` rendering logic
  (`src/AccessLogLabels.hpp`) for `authorizationLabel`/
  `identificationLabel`, numerically verified against a live-captured
  real value (`1717658368 == getIdentifierId("face", 0)` → "Facial").
- **A genuine schema gap was found and fixed mid-execution**: `Name
  (Time Zone)` has no direct field on `access_logs` (unlike Portal) —
  it requires a 2-hop join (`access_logs → access_log_access_rules →
  access_rule_time_zones → time_zones`), discovered when Codex
  correctly stopped instead of guessing. Added `Task 1.5`
  (`timeZoneNamesForAccessLogIds()`) with an explicit, tested,
  deterministic tie-break rule for the theoretically-many-to-many
  junction tables involved.
- **A pre-existing bug was fixed as a side effect**: `from` was
  previously applied as a client-side post-filter, not a server-side
  `where` clause (a known, documented limitation) — now both `from`
  and `to` are server-side (empirically confirmed live that chained
  `where` array clauses work), which was *required* for the new
  `total` count to stay mathematically consistent with the page.

## Execution notes

Codex (the configured execution backend) implemented Group 1 (Tasks
1.1-1.4) and Task 2.1, each independently re-verified by Claude via
direct source reads and fresh builds — not trusted on self-report
alone. Mid-Task-2.2, Codex hit its OpenAI usage limit right after
correctly surfacing the time-zone-join schema gap. At the user's
explicit instruction, Claude completed the remainder directly (Task
1.5 onward through Group 5), applying the identical independent-
verification rigor to its own changes.

Along the way, a Plan Review pass (2 rounds — REJECT then PASS) caught
3 real issues before execution began: a `write_scope` gap (2 header
files), a same-type positional-argument hazard in the new
`buildAccessLogsListBody(from, to, ...)` signature (which would have
compiled cleanly if swapped — now guarded by both a pinned parameter
order and a value-checking test), and an underspecified "Unknown"
default. A separate mid-execution amendment pass (Pass 4) reviewed the
Decision 2b fix itself before resuming.

A `PLAN_DRIFT_DETECTED` block was also hit at the APPROVED→executor
transition, caused by two already-completed prior plans (2026-09-13
redesign, 2026-09-14 modal-fix) sitting uncommitted — resolved, with
the user's explicit go-ahead, by committing them and correcting this
plan's stale `git_sha` baseline.

## Test results

- SDK offline suite: **108/108 passed** (95 baseline + 13 new).
- Backend offline suite: **43/43 passed** (41 baseline − 1 replaced +
  3 new).
- 4 pre-existing test failures — silently introduced by the Group 1
  SDK changes before any test updates — were found and fixed as part
  of this same pass (a stale fixture, one outdated behavioral
  assertion).
- Live verification (Group 5, read-only, against `http://192.168.2.156`
  via the project's own frontend/backend): full pass, including an
  unplanned but valuable real-world confirmation — the device produced
  a genuine "Web Interface" identification row (not previously
  observed), correctly classified by the ported label logic on the
  first try.

## Deferred (explicitly, not silently dropped — see spec.md Decision 6 / docs/api-roadmap.md)

- User/Group/Time Zone filter *dropdowns* (the existing from/to date
  filters still work) — the Group dropdown specifically needs a "list
  all groups" API this project doesn't have yet.
- Export/Print — needs its own `report_generate.fcgi` discovery pass.
- The other 4 report variants (Access by Group/Time/User, Alarms,
  Users).

## Post-ship addendum (same day): visual-parity fixes

The user directly compared our page against the real device's report
page and reported a mismatch. Live comparison (fresh screenshots both
sides) found 4 concrete gaps, all fixed: the Authorization column now
renders the real device's own tri-state icon (green check / red X /
grey X — traced to `report.js`'s literal `checkBoolean()`, reusing
this project's existing `booleanIcon()` helper generalized and moved
to the shared `app.js`) instead of plain text; the date/time filter is
now 4 separate fields (Start/End Date, Start/End Time) instead of 2
combined `datetime-local` inputs; the page title/sidebar now read
"Access (Global)"; the first 3 column headers gained their
"(Access Logs)" suffix. Live-verified, including a regression check
that the Users page's own icon columns (Password, Administrator) are
unaffected. See spec.md Decision 7 / DECISION_LOG.md for full detail.

## What's next

Nothing outstanding for this plan. Next roadmap items (per
`docs/api-roadmap.md`'s "Suggested next discovery pass"): Visitors →
Holidays → User Types → Groups write-side → Time Zones write-side, or
either of the two Access Logs follow-ups above.
