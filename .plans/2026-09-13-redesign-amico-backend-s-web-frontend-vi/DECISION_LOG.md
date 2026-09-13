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

## Superseded decisions

> Move entries here when a later decision overrides them.
> Keep them for historical context — do not delete.

_None yet_

## 2026-09-13 — Execution decisions and plan discrepancies

- Applied the local frontend-design skill at
  `C:/Users/Admin/.claude/plugins/cache/claude-plugins-official/frontend-design/3deb821cb71c/skills/frontend-design/SKILL.md`.
  Design direction follows the explicit brief: captured blue/navy palette,
  13px Roboto/system-ui/sans-serif, white 220px sidebar, blue header, split
  login with the captured rounded corner, compact five-tab dialog. Text-only
  project wordmark; omit copyright rather than invent an owner.
- Task 1.1's parenthetical Font Awesome reference contradicts corrected Task
  3.1 and spec Decision 5. Followed the correction and explicit user instruction:
  locally authored inline SVG only, with accessible labels; no CDN/font fetch.
- The saved theme CSS includes a #e6e6e6 sidebar background and a 4px accent,
  whereas Task 1.1 explicitly requires white and 3px. Followed the explicit
  task and spec direction. Neutral colors come from the saved capture.
  The capture's #62c462 is a select-control border, not evidence of an Add
  button color; retained the task's #2ecc71 success fallback and #e74c3c danger.
  Dark text on these filled buttons maintains readable contrast.
- Tasks 2.1/2.2 incorrectly describe node --check as checking DOM selectors.
  It checks syntax only. Added static original-ID/nav-contract verification
  and automated offline browser behavior checks with mocked fetch responses.
- Task 1.1 and Task 3.2 pass wording depends on Group 6, and spec's claim that
  no write is needed to verify conflicts with Task 6.2's live create test.
  The user's explicit delegation resolves scope: implement Groups 1-5, report
  offline checks, defer all Group 6 visual/live acceptance without claiming it.
- Create returns {id}, confirmed read-only in backend/Routes.cpp. Assign this
  ID and unlock tabs immediately after POST succeeds, before reusing existing
  profile/list refreshes. A failed refresh cannot turn the next Save into a
  duplicate POST. Existing operation bodies, confirmation headers, dialogs,
  JPEG conversion, photo rendering and session logic are retained.
- New dialog panel IDs use user-panel-/user-tab- prefixes to avoid login.js's
  existing [id^='tab-'] page-reset selector. All original DOM IDs are retained;
  app.js and login.js need no changes. Administrator and PIN remain together
  under the fourth tab, as explicitly requested.
- No backend changes, device requests, external dependencies, or git commits.

**Decided by:** Executor following the user's explicit scope and plan corrections.
**Status:** Active; live/visual verification remains deferred.

---

### 2026-09-13 — Independent verification by Claude (Planner), Task 6.1 complete
**Context:** After Codex's own report, independently re-verified rather
than trusting the report alone: re-ran `node --check` on all 5 JS
files (PASS), re-ran the brand/CDN grep scan (PASS, empty), re-ran the
design-token and DOM-contract grep checks (PASS), rebuilt and re-ran
the SDK/backend offline suites (95/517 and 41/476, unchanged), and
performed a full live visual session against the real device
(`http://192.168.2.156`): login split-screen, sidebar shell, Users
table with icon booleans and working photos, Access Logs, System
Information, and the Add User tabbed modal's pre-save locked state
(exact footnote text confirmed) all matched the captured reference and
worked correctly. Closed the Add User dialog via Close without
submitting — no write action performed.
**Decision:** Task 6.1 and Test L-1 marked complete/PASS based on this
independent verification, not solely on Codex's self-report. Task 6.2/
Test L-2 (the one write action — creating a disposable user to watch
tabs unlock live) intentionally left un-run pending a separate,
fresh `APPROVE_LIVE_DEVICE_WRITE_TEST` approval, per this plan's own
gating and the session's standing write-approval discipline.
**Reasoning:** Matches this project's established practice of
independently verifying Codex's work rather than reporting it done on
the executor's word alone (same discipline applied after every prior
Codex delegation this session).
**Alternatives rejected:** Accepting Codex's own report as sufficient
without independent re-verification — rejected, inconsistent with
established practice.
**Decided by:** Claude (Planner/orchestrator)
**Status:** Active — Groups 1-5 and Task 6.1 complete and verified;
Task 6.2 optional, pending user decision.

---

### 2026-09-13 — `eng verify` FAIL: `KNOWN_HARNESS_BUG`, same category as every prior plan this session
**Context:** `eng verify` reports `docs/backend-api.md` as "unexpected"
— this is an uncommitted cross-reference link to `docs/api-roadmap.md`
added earlier this session, unrelated to this plan's own scope.
**Decision:** Treat as expected, benign drift — this plan's own
independently-verified results are the real signal of correctness.
**Decided by:** Claude (orchestrator)
**Status:** Active — plan complete.

---

### 2026-09-13 — Task 6.2 write approval received
**Context:** User sent `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-13-
redesign-amico-backend-s-web-frontend-vi` as a fresh, distinct message.
**Decision:** Proceeding with Task 6.2 — create one disposable test
user via the General tab, confirm the other 4 tabs unlock in place
(no dialog close/reopen), delete the test user afterward.
**Decided by:** Claude (orchestrator)
**Status:** Active

---

### 2026-09-13 — Task 6.2 complete: PASS, plan fully done
**Context:** Created disposable test user `ZZ_TabUnlockTest` (id 47)
live against `http://192.168.2.156`.
**Result:** The same dialog instance (no close/reopen) unlocked all 4
extra tabs (Groups/Cards/PIN/Facial) immediately after the General
tab's Save succeeded, with the exact status message "User created. All
tabs are now available." Facial tab confirmed to render fully. Test
user deleted afterward; confirmed via snapshot that only the original
3 real users remain.
**Decision:** This plan's full scope (Groups 1-5 + both Group 6 tasks)
is now complete and independently verified.
**Decided by:** Claude (orchestrator)
**Status:** Active — plan complete.
