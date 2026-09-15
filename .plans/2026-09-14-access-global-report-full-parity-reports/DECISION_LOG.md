# Decision Log — [Feature Name]

> **Purpose:** Record every significant decision made during planning OR execution.
> Both the Planner (Claude) and Executor (Copilot) should add entries here.
> This file is read by Claude Code at the start of every future sprint to
> avoid revisiting closed decisions.
>
> **When to add an entry:**
> - A design alternative was rejected
> - An implementation approach changed mid-sprint
> - A dependency or library was chosen over an alternative
> - A scope item was added or removed during execution
> - A bug was found that changed the implementation strategy

---

## Decisions

### 2026-09-14 — User chose full-scope parity (items 1-5), not a smaller cut
**Context:** User reported "web của mình thật sự là custom không giống
với device thật luôn" (our web looks nothing like the real device) for
the Access (Global) report page. Presented via `AskUserQuestion` four
options ranging from "visual/layout only" to "everything (1-5)".
**Decision:** User selected "Làm hết tất cả (1-5)" — full parity,
including the previously-deferred User/Group/Time Zone filters and
Export, not just the sidebar/breadcrumb/chrome visual items.
**Reasoning:** N/A — direct user choice.
**Alternatives rejected:** The three smaller-scope options (visual
only; +User/Group/TimeZone only; +Export only) — not chosen.
**Decided by:** User
**Status:** Active.

---

### 2026-09-14 — `eng plan approve-spec` does not itself advance workflow state; `eng workflow advance` must be called separately
**Context:** Calling `eng plan approve-spec <plan-dir>` (twice, per
the already-known harness quirk from prior plans) recorded
`spec_approved_at`/`spec_approved_by` in `plan.yaml` and logged a
`spec_approved` event each time, but `state` remained `TRIAGED` and
`eng adapter prompt plan-reviewer` was refused
("not compatible with state TRIAGED"). This is a *different*
manifestation of harness friction than the previously-documented
`PLAN_DRIFT_DETECTED`-at-scaffold-time pattern (that one still let
state reach `APPROVED`; this one blocked at the very first
transition).
**Decision:** Found the working sequence empirically:
`eng plan approve-spec` → `eng workflow advance` (TRIAGED →
NEEDS_SPEC_APPROVAL) → `eng plan approve-spec` again → `eng workflow
advance` (→ SPEC_APPROVED → PLANNED). Not chasing why `approve-spec`
alone didn't drive the transition (standing instruction: don't patch/
investigate the harness itself) — recording the working sequence here
so a future plan in this session doesn't have to rediscover it.
**Reasoning:** Matches this project's standing practice of recording
`KNOWN_HARNESS_BUG` occurrences factually and moving on, rather than
patching the harness.
**Alternatives rejected:** N/A.
**Decided by:** Claude (Executor/orchestrator)
**Status:** Active — workaround, not a fix.

---

### 2026-09-14 — Execution handed to Codex; `/users` filter-dropdown pagination gap caught in review before live sign-off
**Context:** User asked to hand implementation off to Codex ("đưa cho
codex dev đi") to conserve their own tokens. Codex ran across 4
invocations, repeatedly hitting a transient "Selected model is at
capacity" API error partway through (not a real task failure); each
retry picked up from the last completed task and made further
progress until Groups 1-7 were fully done (121 SDK tests, 51 backend
tests, all offline checks passing). Before running the live Task 8
check, reviewed Codex's Task 5.3 work directly and found: `GET /users`
defaults to `AmicoConfig::defaultPageSize` (50 rows) with no `limit`
param, unlike `/groups`/`/timezones` (always return every row) — the
User filter dropdown was silently building its option list from only
the first 50 users.
**Decision:** Fixed directly (one-line change, not worth another Codex
cycle): `frontend/access-logs.js`'s fetch path for the User filter
changed to `/users?limit=100000`. Confirmed the fix live during Task
8.1 (network log shows the corrected request going out).
**Reasoning:** Harmless on this specific device (5-6 real users today)
but a real correctness gap for a larger one — exactly the kind of
thing that should be caught before sign-off, not shipped silently.
**Alternatives rejected:** Adding pagination UI to the filter dropdown
itself — rejected as unnecessary complexity; a large `limit` ceiling
matches this project's existing "just ask for effectively everything"
convention for lookup-only lists.
**Decided by:** Claude (Executor), verified before Task 8.1's live
approval was requested
**Status:** Active — fixed and live-confirmed.

---

### 2026-09-14 — `eng verify` FAIL accepted (same KNOWN_HARNESS_BUG as every prior plan this session)
**Context:** `eng verify` after Task 8.1 flags 9 files as "unexpected
changes outside write_scope": `CMakeLists.txt`, `docs/api-roadmap.md`,
`frontend/app.js`, `frontend/users.js`, `test/UserProfileResponder.hpp`,
`test/fixtures/access_logs_list.json`, `test/test_errors.cpp`,
`test/test_query_whitelist.cpp`, `test/test_users.cpp`. Every one of
these belongs entirely to earlier, already-completed plans this session
(Visitors, the Enroll-sidebar addendum, the photo-cache-bug fix) —
none of them were touched by this plan's own work.
**Decision:** Accepted as the same structural harness limitation
already documented for every prior plan this session: as long as
commits are deferred (the user's own standing "để commit sau"
choice), `eng verify` diffs against the last real commit, which
still includes every earlier uncommitted plan's files. Not adding
these nine files to this plan's `write_scope` — doing so would
misattribute other plans' work to this one. `tasks.md`'s own
per-task verification (all `[x]`, both suites clean, plus this
plan's own live Task 8.1) remains the actual source of truth.
**Reasoning:** Consistent with the precedent set for every earlier
plan this session; re-litigating it here would just repeat the same
accepted conclusion.
**Alternatives rejected:** Adding the nine foreign files to this
plan's `write_scope` to force a clean `eng verify` — rejected, would
misattribute other plans' changes to this one.
**Decided by:** Claude (Executor/orchestrator)
**Status:** Active.

---

## Superseded decisions

> Move entries here when a later decision overrides them.
> Keep them for historical context — do not delete.

_None yet_
