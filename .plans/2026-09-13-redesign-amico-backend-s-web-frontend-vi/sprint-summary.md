# Sprint Summary — Frontend visual redesign

**Date:** 2026-09-13
**State:** Complete — Groups 1-5 (implemented by Codex, independently
verified by Claude) and both Group 6 tasks (visual check + live
tab-unlock write test, both performed and verified by Claude).

## What shipped

The web frontend now visually matches the real AMICO device's own web
UI, using color/typography/layout tokens captured live from the real
device this session (blue gradient `#003087→#0057B7`, navy `#002D56`
primary buttons, `Roboto`/`system-ui` font stack, 4px radius): a
persistent left sidebar shell replacing the old flat tab bar, a
split-screen login page matching the real login's layout, icon-based
boolean table columns (inline SVG, no external dependency), and — the
change that also resolves this session's earlier reported UX confusion
— a single tabbed Add/Edit User dialog (General/Groups/Cards/PIN/
Facial) where the four extra tabs stay disabled until the first
successful create, exactly matching the real device's own confirmed
"(*) Save the user to enable editing of all fields" behavior.

No HID/Amico trademarked logo or brand text was reused anywhere (text-
only wordmark instead); no external CDN/font/icon library was added
(this project's frontend remains zero-dependency, matching Giai đoạn
4's own founding decision) — both hard constraints confirmed via grep
scan, not just claimed.

## Implemented by Codex, independently verified by Claude

- `frontend/style.css`: full rewrite with the captured design tokens.
- `frontend/index.html`: sidebar shell, split-screen login, text-only
  wordmark.
- `frontend/users.js`: unified tabbed Add/Edit dialog with real-device-
  matched tab-lock behavior; inline-SVG icon boolean columns.
- `frontend/access-logs.js`, `frontend/system-info.js`: markup/class
  adjustments only, no logic change.
- `docs/src-map.md`: updated to note the redesign.

## Test results (independently re-run by Claude, not just Codex's report)

- `node --check` on all 5 modified/dependent JS files: PASS.
- Brand/CDN grep scan: PASS (empty — no HID/ASSA ABLOY text, no
  copied device image reference, no cdnjs/fonts.googleapis reference).
- Design-token grep scan: PASS (all 3 primary hex values present).
- DOM-contract grep scan: PASS (all ids `app.js`/`login.js` depend on
  — `data-tab`, `aria-controls`, all 7 login-form ids, `connected-
  device`/`logout` — preserved verbatim).
- SDK offline suite: **95 cases / 517 assertions**, unchanged.
- Backend offline suite: **41 cases / 476 assertions**, unchanged
  (this plan touches no backend/SDK file).
- Codex's own 23-case offline mocked-browser test suite (tab order,
  pre-create lock, exact footnote text, create-then-unlock, PATCH
  without duplicate POST, accessible booleans, keyboard navigation,
  etc.) — reviewed and found sound.

## Live verification (both read-only and write, both performed by Claude)

- **Task 6.1 / Test L-1 (read-only):** full live session against
  `http://192.168.2.156` — login split-screen, sidebar shell, Users
  table (icon booleans + all 3 real users' photos still rendering
  correctly, confirming no regression of the prior photo-display fix),
  Access Logs (50 real entries), System Information (real device
  fields), and the Add User dialog's pre-save locked state (exact
  footnote text confirmed) all matched the captured reference. No
  console errors. Dialog closed without submitting — no write
  performed for this part.
- **Task 6.2 / Test L-2 (write, after a fresh
  `APPROVE_LIVE_DEVICE_WRITE_TEST` approval):** created a disposable
  test user (`ZZ_TabUnlockTest`, id 47) via the General tab. Confirmed
  the *same* dialog instance (no close/reopen) immediately unlocked
  all 4 extra tabs with the exact status message "User created. All
  tabs are now available."; the Facial tab was checked and rendered
  fully. Test user deleted afterward; confirmed via a fresh snapshot
  that only the 3 original real users (5, 36, 4) remain.

## Process notes

- Plan Review caught a real self-introduced inconsistency before
  execution: an earlier draft of Task 1.1/3.1 assumed Font Awesome/
  Google Fonts were "already an existing convention" in this project —
  a direct grep found zero prior external-CDN usage. Corrected to
  inline SVG icons and a `system-ui` font fallback before handing off
  to Codex, avoiding what would have been this frontend's first-ever
  external dependency.
- Codex found and disclosed several of its own real findings rather
  than silently guessing: the stale Font Awesome reference left in
  Task 1.1's own text after the Task 3.1 correction; that `node
  --check` only validates syntax, not DOM contracts (added proper
  static ID-contract checks and a mocked-browser harness instead); a
  minor sidebar color/accent-width mismatch between the raw capture
  and the task's explicit instruction (followed the explicit task
  text); used distinct `user-panel-`/`user-tab-` id prefixes to avoid
  colliding with `login.js`'s existing `[id^='tab-']` selector — a
  subtle correctness detail not explicitly specified in the task.
- One cosmetic, non-code rendering oddity was noticed during live
  visual review (two user names appeared with a transient blue/
  underline look in one screenshot) and ruled out via
  `getComputedStyle` (showed normal color/no text-decoration in the
  actual DOM) — a browser-chrome-level artifact, not a real defect.

## What's next

Nothing outstanding for this plan.
