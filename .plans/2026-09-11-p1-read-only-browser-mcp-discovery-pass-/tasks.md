# Tasks — P1: Read-Only Web UI Discovery Pass

> Status markers: `[ ]` not started, `[~]` in progress, `[x]` complete
> (verification run), `[!]` failed. Only one task `[~]` at a time.
> **Hard constraint across every task in this file:** never click/submit
> Add, Edit, Delete, Save, Import, Restore, Firmware update, Network
> update, Date/time update, Face enrollment, Card enrollment, Relay
> activation, License update, or EAM update. Observe and statically read
> only.

---

## Group 1 — Session setup

### Task 1.1 — Log in and confirm session
**Action:** Navigate to `http://192.168.2.156/`, log in as `Admin` (same
credential as Phase 1), confirm the dashboard loads.
**Verification:** `session_is_valid.fcgi` returns `true` after login (via
network panel).
**Status:** `[x]`

---

## Group 2 — Users list, detail, search/filter/sort/pagination

### Task 2.1 — Users list page
**Action:** Navigate to the Users page (not just the dashboard widget).
Capture network requests, DOM snapshot, screenshot.
**Verification:** At least one `load_objects.fcgi` (or equivalent) request
captured with `object` and full field list for the dedicated page (as
opposed to the dashboard's narrower query).
**Status:** `[x]`

### Task 2.2 — User detail view
**Action:** Open one existing user's detail/edit view (read-only
inspection — view the form, do not change or save anything). Capture
network + snapshot.
**Verification:** Request/response captured for the detail fetch.
**Status:** `[x]`

### Task 2.3 — Search / filter / sort / pagination
**Action:** On the Users list (or another listing page that supports it),
exercise: a search/filter input, a column sort, and paging to a second
page if enough rows exist. Capture the resulting network requests for
each.
**Verification:** At least one request captured per capability (search,
filter, sort, page-2), showing the actual `where`/`order`/`limit`/`offset`
shape used by the real UI.
**Status:** `[x]`

---

## Group 3 — Groups, Areas, Schedules, Reports, License, EAM, date/time

### Task 3.1 — Groups page
**Status:** `[x]`

### Task 3.2 — Areas page
**Status:** `[x]`

### Task 3.3 — Schedules page
**Status:** `[x]`

### Task 3.4 — Reports / access-log page
**Action:** View existing reports/access-log listing only. If a "Generate
report" control exists, do not click it — note its presence for P2
(static analysis) instead.
**Status:** `[x]`

### Task 3.5 — License page
**Status:** `[x]`

### Task 3.6 — EAM / About info page
**Status:** `[x]`

### Task 3.7 — Date/time display (settings page, view only)
**Action:** View the date/time settings screen without changing or saving
any value.
**Status:** `[x]`

Each of Tasks 3.1–3.7 follows the same verification shape: capture network
requests + DOM snapshot + screenshot for the page; record method/path/
request/response shape for anything not already documented.

**Common verification for Group 3:** each page visited produces at least
one captured network request attributable to that page (or an explicit
note that the page is purely client-side/static with no new request).

---

## Group 4 — Logout

### Task 4.1 — Logout and confirm invalidation
**Action:** Log out; confirm `session_is_valid.fcgi` returns `false`
afterward (re-confirms Phase 1's finding still holds after a longer,
multi-page session).
**Status:** `[x]`

---

## Group 5 — P2: static analysis of write-control handlers

### Task 5.1 — Read JS handlers for every write control encountered
**Action:** From the JS files already fetched during Groups 1–4 (no new
device requests needed), statically read the handler and payload-builder
for each control seen: Add/Edit/Delete/Save (per page visited), Import,
Restore, Firmware update, Network update, Date/time update, Face
enrollment, Card enrollment, Relay activation, License update, EAM update.
For any control whose handler wasn't visible on a page actually visited in
Groups 2–3, mark it "not encountered this pass" rather than guessing.
**Verification:** A `UI_HANDLER_CONFIRMED` (or "not encountered") entry
exists for every control in the list above.
**Status:** `[x]`

---

## Group 6 — Write artifacts

### Task 6.1 — `docs/ui-action-protocol-map.md` + `artifacts/ui-action-map.json`
**Action:** Write the full per-action evidence map from Groups 2–5's
findings.
**Verification:** Files exist; JSON parses; every row has an `evidence`
grade from the parent spec's legend (including `UI_HANDLER_CONFIRMED`).
**Status:** `[x]`

### Task 6.2 — Merge findings into existing endpoint docs
**File:** `docs/amico-endpoints.md`, `docs/amico-protocol-map.md`, `artifacts/amico-endpoints.json`
**Action:** Add newly confirmed endpoints; add the `UI_HANDLER_CONFIRMED`
grade to the evidence legend in `docs/amico-protocol-map.md`.
**Verification:** `artifacts/amico-endpoints.json` still parses as valid
JSON; no existing `LIVE_CONFIRMED` row is weakened or removed.
**Status:** `[x]`

### Task 6.3 — Sanitized network-events artifact
**File:** `artifacts/live_capture/sanitized-network-events.json`
**Action:** Write a sanitized summary of this session's captured requests
(method/path/status/shape only — no real session token/hash/salt values),
per `docs/security-sanitization-policy.md`.
**Verification:** File parses as JSON; secret scan (reuse
`.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/tests.md`
Test V-2 commands) is clean against it.
**Status:** `[x]`

### Task 6.4 — Re-evaluate the P4 discovery gate
**File:** `.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/spec.md` (documentation update only — that plan's workflow state stays `COMPLETED`, this is an evidence-status edit, not a re-execution)
**Action:** Update the 13-point gate's per-item status based on this
pass's findings.
**Verification:** All 13 items marked pass/fail/still-pending with a
one-line reason each.
**Status:** `[x]`

---

## Completion checklist

- [x] All tasks marked `[x]`
- [x] No tasks marked `[!]`
- [x] No write control was ever clicked/submitted (verified: sanitized-network-events.json contains only GET page loads, load_objects.fcgi, hidlogin.fcgi, logout.fcgi, system_information.fcgi, session_is_valid.fcgi)
- [x] Secret scan clean on all new artifacts
- [x] Sprint summary written

---

## Rollback procedures

No destructive action is taken against the device (read-only pass) or the
repo (only new/modified docs and artifacts, all git-trackable and
revertable with `git checkout -- <file>` if needed).
