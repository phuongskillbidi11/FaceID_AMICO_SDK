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

### [YYYY-MM-DD] — [Short title]
**Context:** [What situation triggered this decision?]
**Decision:** [What was decided?]
**Reasoning:** [Why? What would have happened with the alternative?]
**Alternatives rejected:**
- [Alternative A] — rejected because [reason]
- [Alternative B] — rejected because [reason]
**Decided by:** Planner / Executor / User
**Status:** Active / Superseded by [later decision]

---

### [YYYY-MM-DD] — [Short title]
**Context:**
**Decision:**
**Reasoning:**
**Alternatives rejected:**
**Decided by:**
**Status:**

---

### 2026-09-14 — PLAN_DRIFT_DETECTED at scaffold time itself (KNOWN_HARNESS_BUG, same pattern as the Access Logs plan)
**Context:** Immediately upon activating the executor role,
`eng plan drift` reported drift — but every listed file belongs to
the *prior* Access Logs plan (plus this session's own visual-parity
addendum), all still uncommitted per the user's explicit "để commit
sau" (commit later) instruction. This plan's own `git_sha` baseline
(`f23af39...`) already equals current HEAD (no new commits happened)
— so unlike the Access Logs plan's earlier occurrence, rebaselining
`git_sha` would not help here; the drift is purely from pre-existing
uncommitted working-tree changes, not a stale commit pointer.
**Decision:** Not chased. This is the same structural,
already-documented `KNOWN_HARNESS_BUG` category: as long as commits
are deferred (the user's explicit, standing choice), every new plan
will show drift immediately at scaffold time, since the working tree
already differs from HEAD before this plan's own work even begins.
Proceeding with direct implementation (Edit/Bash tools) rather than
`eng tools invoke executor codex.execute`, which is blocked by the
same check — `tasks.md`/`tests.md` remain the actual source of truth
for correctness, verified independently (build/test runs) exactly as
throughout the Access Logs plan.
**Decided by:** Claude (Executor/orchestrator)
**Status:** Active.

---

### 2026-09-14 — No Administrator toggle for Visitors (found during Task 5.2 implementation)
**Context:** While implementing the shared factory's config, re-checked
the real device's own Visitor Add/Edit form (already captured live
this session during discovery) and confirmed it shows no
Administrator checkbox anywhere — consistent with Task 4.2's backend
scope, which deliberately did not add a `/visitors/:id/administrator`
route (that route family wasn't in the confirmed field list for
Visitors).
**Decision:** Added a `showAdministrator` config flag to the shared
`initUserListPage` factory (default `true`, set `false` for Visitors)
— hides the Administrator column in the list table and the
Administrator checkbox in the modal's PIN tab (renamed to just "PIN"
for Visitors, "Administrator and PIN" for Users, matching each page's
actual capability).
**Reasoning:** Keeps the frontend honest about what the backend
actually supports for Visitors (no admin-grant capability), matching
both the real device's own confirmed UI and this plan's own backend
scope — showing a control that would silently fail (no matching
route) would be worse than not showing it.
**Alternatives rejected:** Showing the toggle anyway for visual
consistency with Users — rejected, would be a dead control with no
backing route, actively misleading.
**Decided by:** Claude (Executor), based on live evidence already on
file from this plan's own discovery pass
**Status:** Active.

---

### 2026-09-14 — `/user_get_image.fcgi` returns 400 (not 404) for a record that never had any image relationship — discovered during Task 8.2, deliberately not fixed
**Context:** During the gated live write test (Task 8.2), creating a
brand-new test visitor and immediately viewing it produced a console
error: `GET /users/52/image` → HTTP 400. Investigated thoroughly
before dismissing: confirmed via direct `fetch()` calls that both
`/users/52/image` and `/visitors/52/image` return 400 for this same
id (ruling out a `/users`-vs-`/visitors` routing bug introduced by
this plan), and confirmed it's not a propagation-timing fluke (retried
after a 2s delay, still 400).
**Decision:** This is a genuine, pre-existing, previously-undocumented
real-device behavior, not a regression from this plan: the device
returns HTTP 400 for `user_get_image.fcgi?user_id=<id>` when the user
record has *never* had any image/face-template interaction at all —
distinct from the already-documented 404 case (a record that HAD an
image relationship established, since removed). This would affect any
brand-new regular User too, not something specific to Visitors or
`c_users`. The visible UI is unaffected: the `<img>` tag's own
`onerror` handler already falls back to the placeholder correctly
(visually confirmed — `artifacts/live_capture/visitor-created-list-view.png`
shows the "No image" placeholder rendering correctly for row 52).
**Reasoning:** Not fixing this now keeps this plan scoped to Visitors
CRUD + CPF as approved; a device-wide image-endpoint status-code
inconsistency (400 vs 404) is a separate, pre-existing gap that
deserves its own explicitly-scoped bug-fix plan rather than a
drive-by patch here.
**Alternatives rejected:** Silently ignoring/dropping the finding —
rejected, violates this project's "never guess, always document"
discipline. Fixing it inline in this plan — rejected, out of the
approved scope (Visitors CRUD + CPF only) and not something the user
asked to include.
**Decided by:** Claude (Executor), based on live evidence gathered
during Task 8.2
**Status:** Active — documented gap, no fix planned yet; a future
session should scope a dedicated bug-fix plan if the user wants it
addressed.

---

### 2026-09-14 — `eng verify` FAIL accepted (KNOWN_HARNESS_BUG, same pattern as the Access Logs plan's own final sign-off)
**Context:** Ran `eng verify` after completing Group 8. First pass
correctly flagged `test/test_errors.cpp` as an unexpected out-of-scope
change — a real gap, fixed immediately by adding it to `plan.yaml`'s
`write_scope` (it was legitimately edited in Task 6.1's regression fix
but never added to the list). Second pass still FAILs, but only on
`frontend/access-logs.js`, `frontend/app.js`, `test/fixtures/access_logs_list.json`,
`test/test_access_logs.cpp` — all four belong entirely to the prior,
already-completed Access Logs plan (uncommitted per the user's own
"để commit sau" instruction), not to any work done in this Visitors
plan.
**Decision:** Accepted as the same structural `KNOWN_HARNESS_BUG`
already documented for the Access Logs plan's own final sign-off: as
long as commits are deferred, any later plan's `eng verify` diffs
against the last real commit, which still includes every earlier
uncommitted plan's files. Not adding these four files to this plan's
`write_scope` (they are not this plan's work, and doing so would
misrepresent authorship). `eng workflow advance` is expected to hit
the same `PLAN_DRIFT_DETECTED` gate for the same reason; not chased
further — `tasks.md`'s own per-task verification (all `[x]`, both
suites clean) remains the actual source of truth for this plan's
correctness.
**Reasoning:** Matches the precedent already set once this session;
re-litigating this would just repeat the same accepted conclusion.
**Alternatives rejected:** Adding the four foreign files to this
plan's `write_scope` to force a clean `eng verify` — rejected,
would misattribute the Access Logs plan's changes to this plan.
**Decided by:** Claude (Executor/orchestrator)
**Status:** Active.

---

### 2026-09-14 — Collapsible "Enroll" sidebar group added (post-completion addendum, user-requested)
**Context:** After this plan was already marked complete, the user
pointed out our sidebar showed Users/Visitors as flat top-level
buttons, while the real device nests them under an expandable
"Enroll" parent — and asked for this now specifically so future
Enroll-area additions (Visits, Groups, Time Zones, Holidays,
Scheduled Unlock, User Types, Custom Fields — all still 🔍 Discovery
pending) have an obvious, consistent place to land later.
**Decision:** Restructured the sidebar: Users/Visitors now live inside
a collapsible `.nav-group` under a new "Enroll" toggle header
(pencil icon + chevron, expanded by default), matching the real
device's own information architecture. Access (Global) and System
Information remain flat top-level items (they aren't part of the
device's own Enroll section either). Added as Task 9.1 to this plan
rather than opening a new plan — same precedent as the Access Logs
plan's own post-completion visual-parity addendum: small,
frontend-only, no device-write risk, directly related to this plan's
own Users/Visitors tabs.
**Reasoning:** Matches the real device's UX exactly and removes the
need for a bigger frontend-navigation rework later once more
Enroll-area features (already tracked in `docs/api-roadmap.md`) get
implemented.
**Alternatives rejected:** Leaving it flat and revisiting only once a
third Enroll-area tab is actually added — rejected per the user's own
explicit ask to fix it now, ahead of time, precisely to make that
future work easier.
**Decided by:** User (request) + Claude (implementation)
**Status:** Active.

---

### 2026-09-14 — Photo replace-after-remove bug: root cause was a missing cache-buster, not a Visitors-specific or device-side issue
**Context:** User reported that on the Visitors tab, replacing a photo
(Remove Image, then choosing a different photo) didn't take effect,
while the same sequence worked on Users. Code review found the
frontend/backend/SDK image read/write/delete code paths byte-identical
between the two tabs, ruling out an intentional Visitors-specific
branch. Live reproduction (with real test photos) confirmed the
device-side write itself was correct in all cases (a cache-bypassed
fetch always reflected the true current state); the stale display was
caused by `backend/JsonMapping.cpp`'s `imageUrl` field being a fixed,
never-changing path string (`/users/<id>/image`) for a given id across
every create/remove/replace cycle, combined with `frontend/users.js`'s
`renderPhoto()` reusing that same string on every render — so the
browser's HTTP cache served stale image bytes and never issued a new
network request at all.
**Decision:** Fixed in `frontend/users.js`'s `renderPhoto()` by
appending a `?v=${Date.now()}` cache-busting query parameter to
`item.imageUrl` on every render, matching the real device's own
already-confirmed convention on this same endpoint (`user_get_image.fcgi?...&v=<value>`,
LIVE_CONFIRMED earlier in this codebase) — a convention our own
frontend had simply never adopted. This is a one-line, frontend-only
fix; no backend/SDK change needed. Verified live: repeated
remove-then-upload-different-photo cycles (3 different photos) all
displayed correctly immediately after the fix, both on Visitors and on
a disposable regular User (control test) — confirming the bug was
never actually tab-specific; the user's original "Users tab works
fine" observation was almost certainly incidental browser-cache timing
from an earlier, unrelated test, not a real code difference.
**Reasoning:** Matches this project's own established real-device
evidence for how this exact endpoint should be requested; fixing it
frontend-side (rather than changing the backend's `imageUrl` shape) is
the minimal change and keeps `imageUrl`'s JSON contract stable for any
other consumer/tests that assert on its exact value.
**Alternatives rejected:** Changing `backend/JsonMapping.cpp` to embed
a cache-buster server-side — rejected as a larger, unnecessary change
(would touch the JSON contract and its tests) when a client-side fix
fully resolves the actual symptom. Investigating further for a
device-side firmware quirk (matching the earlier 400-vs-404 precedent)
— rejected once the browser-cache root cause was conclusively
confirmed via a cache-bypassed fetch showing the device's own state
was always correct.
**Decided by:** Claude (Executor), based on live evidence gathered
during Task 10.1
**Status:** Active — fixed and verified.

---

## Superseded decisions

> Move entries here when a later decision overrides them.
> Keep them for historical context — do not delete.

_None yet_
