# Tasks — Redesign the web frontend to match the real AMICO device's look and feel

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-5** are pure frontend (CSS/HTML/client-JS) changes —
>   verifiable via `node --check` (syntax) and a local `file://`/backend
>   visual check with NO device write action (only the already-working
>   login/list calls, no new user created).
> - **Group 6** (manual visual verification of the tab-lock behavior,
>   which requires actually creating one disposable test user to watch
>   the tabs unlock) requires a fresh, distinct
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval — this plan's
>   only write action anywhere.

---

## Group 1 — Design tokens: `frontend/style.css` rewrite

### Task 1.1 — Replace `style.css` with the real device's captured tokens
**Action:** Rewrite `frontend/style.css` using the exact values captured
live this session (see spec.md Decision 1, `artifacts/live_capture/
theme_default_css.network-response` / `login_css.network-response`):
- Base font: **no external font CDN** (corrected — see Task 3.1's
  same self-catch; this project's `frontend/` has zero external CDN
  dependencies today, and Giai đoạn 4's own Decision 1 deliberately
  chose "no framework, no build step"). Use `Roboto, system-ui,
  sans-serif` as the font stack — `Roboto` if the operator's OS
  happens to already have it installed (harmless, common on
  Android/some Linux distros), falling back to `system-ui` everywhere
  else, so visual intent is preserved without adding any network
  dependency. Base size `13px`.
- CSS custom properties (`:root`) for: `--brand-blue: #0057B7`,
  `--brand-blue-dark: #003087`, `--brand-navy: #002D56`, `--brand-
  gradient: linear-gradient(52.62deg, var(--brand-blue-dark) 20.39%,
  var(--brand-blue) 82.87%)`, `--radius: 4px`, `--danger: #e74c3c`,
  `--success: #2ecc71` (or the closest evidence-matched green — confirm
  exact hex by re-inspecting the live capture if a more precise value
  is available, don't invent one if it isn't).
- Sidebar shell styles: `.sidebar` (white background, full height,
  fixed width ~220px), `.sidebar button[aria-pressed="true"]` (left
  accent bar via `border-left: 3px solid var(--brand-blue)`, blue
  text), inactive items in dark gray.
- Top header bar: `.app-header` using `var(--brand-blue)` background,
  white text, the wordmark text-only (no logo image).
- Login page: `.login-split` two-column layout (left panel using
  `var(--brand-gradient)`, right panel white with a centered card),
  matching the real login page's structure.
- Table styling: light row separators, `.icon-yes`/`.icon-no` classes
  for boolean columns (used by Task 3.1's Font Awesome icons).
- Buttons: primary (`var(--brand-navy)` background, white text,
  `var(--radius)`), success/"add" (green), danger/"remove" (red),
  matching the real device's ADD/Remove/PRINT button coloring.
- Modal/dialog: tab bar styles — `.tabs`, `.tab-button[aria-
  selected="true"]` (blue underline + blue text), `.tab-
  button:disabled` (grayed out, not clickable), `.tab-panel[hidden]`.
**Verification:** `node --check frontend/style.css` is not applicable
(CSS, not JS) — instead: no build step for CSS in this project: verify
by loading the page locally (Task 6.x) and by a plain syntax sanity
check: `npx -y css-validator frontend/style.css` if available offline,
otherwise a manual visual review is the verification (no automated CSS
test framework exists in this project — same accepted limitation as
Giai đoạn 4's spec.md).
**Pass:** File parses as valid CSS (no browser console CSS parse
errors when loaded, checked in Task 6.x); the values above are present
verbatim (`grep -c` for a couple of the hex values as a cheap sanity
check).
**Fail:** Any invented color/value not traceable to the live capture
evidence, or a CSS syntax error visible in the browser console.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Shell restructure: `frontend/index.html`

### Task 2.1 — Sidebar shell + top header bar (replacing the flat `<nav>`)
**Action:** Restructure the `<body>` markup: a `.app-header` bar (text
wordmark, replacing the current plain `<h1>`, keeping the existing
`#connected-device`/`#logout` elements — same ids, so `app.js`/
`login.js` need no functional change, only their surrounding markup/
classes change); a `.sidebar` `<nav>` element containing the existing
three `data-tab` buttons (Users / Access Logs / System Information),
now styled as a vertical list per Task 1.1's sidebar CSS — no new tab
added (Decision 3 — no placeholder entries for unimplemented areas).
`#device-content` becomes the main content area next to the sidebar
(flex/grid layout: sidebar + main side by side).
**Verification:** `node --check frontend/app.js` (confirms `app.js`'s
existing `document.querySelectorAll("nav [data-tab]")` selector still
matches the restructured markup — do not rename the `data-tab`
attribute or the `nav` element itself).
**Pass:** Exit 0; the three existing tab buttons still exist with
their exact `data-tab`/`aria-controls` values.
**Fail:** Any change to the `data-tab`/`aria-controls` contract
`app.js` depends on.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — Login page split-screen layout
**Action:** Restructure `#login-view` into a two-panel layout matching
the real login page: a left panel (`.login-split-left`, using the
brand gradient, containing "Amico"-style heading + subtitle text —
keep this project's own existing copy, do not literally say "Amico"
if that risks implying HID's own product; use this project's actual
name/description instead, e.g. "AMICO Management" / "Web interface for
this project's device management" — Planner note: use judgment here,
not a hard requirement, but do not present the page as HID's own
official login) and a right panel (`.login-split-right`, white,
containing the existing login form unchanged — same ids/labels,
`login.js` needs no logic change). Footer copyright/links: remove the
real device's actual "HID Global Corporation/ASSA ABLOY" copyright
text and links (Decision 2 — no impersonation) — replace with this
project's own placeholder text or omit entirely if no project-owner
copyright line is desired (ask Planner/user if unclear at execution
time rather than inventing a company name).
**Verification:** `node --check frontend/login.js` (confirms
`login.js`'s existing element-id lookups — `loginView`, `loginForm`,
`deviceInput`, etc. — still resolve against the restructured markup).
**Pass:** Exit 0; all ids `login.js` references still exist in the
new markup.
**Fail:** Any renamed/removed id `login.js` depends on.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Users tabbed modal + table styling: `frontend/users.js`

### Task 3.1 — Table: icon-based boolean columns
**Action:** **Correction (Plan Review self-catch before pass 1):**
this project's `frontend/` currently has **zero** external CDN
dependencies (confirmed: no `cdnjs`/`fonts.googleapis` reference
anywhere in `frontend/*.html` or prior plan docs) — Giai đoạn 4's own
spec.md Decision 1 deliberately chose "no framework, no build step."
Pulling in an external icon font would be a new departure from that
established self-contained principle, not a continuation of one. Do
**not** add Font Awesome or any external CDN. Instead, render the
boolean columns (Password, Administrator) as small inline SVG
checkmark/X glyphs authored directly in `users.js` (a tiny `<svg>`
string constant per state, styled via Task 1.1's `--success`/`--danger`
tokens) — zero new external dependency, matching this project's
existing self-contained frontend philosophy. Keep an `aria-label` or
visually-hidden text equivalent for accessibility (icon-only cells
must still be screen-reader-readable, matching this project's existing
accessibility discipline elsewhere, e.g. the `alt` text already used
on photo thumbnails).
**Verification:** `node --check frontend/users.js`.
**Pass:** Exit 0; icons render with the correct color per state
(confirmed in Task 6.x); no purely-visual-only boolean cell without an
accessible text equivalent.
**Fail:** Compile error, or an icon-only cell with no accessible text.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — Unify Add + Edit into one tabbed modal, matching the real device's tab-lock behavior
**Action:** This is the plan's central functional-adjacent change.
Replace the current two-flow structure (`addForm` inline form +
separate `openEditor(id)` `<dialog>`) with a single function,
`openUserModal(existingId)` (existingId is `null` for "Add", a real id
for "Edit"), that:
- Always opens the same `<dialog>` with a tab bar: **General | Groups
  | Cards | PIN | Facial** (5 tabs — this project has no Time Zones
  feature yet, so that real-device tab is not included, per spec.md
  Scope Out).
- **General tab:** Name + Employee ID fields (reused from the current
  `addForm`/`details` form logic), a "Save" button. For a new user
  (`existingId === null`), submitting this tab calls `POST /users`
  (today's create call); on success, the modal does NOT close — it
  keeps the same dialog open, now with the returned id, and unlocks
  the other four tabs (removes their `disabled` attribute). For an
  existing user, submitting calls `PATCH /users/:id` (today's update
  call, unchanged).
- **Groups / Cards / PIN / Facial tabs:** exactly today's existing
  `openEditor`'s Groups/Cards/Administrator-and-PIN/Face-image
  fieldsets, moved verbatim into their own `<div role="tabpanel">`
  under a matching `<button role="tab">`. (Administrator is folded
  into the PIN tab's fieldset, matching the real device's own "PIN"
  tab — the real device doesn't have a separate Administrator tab
  either, per the live capture evidence; if this turns out to feel
  wrong in practice, note it in `DECISION_LOG.md` rather than silently
  inventing a 6th tab.) **All four of these tabs are `disabled`
  (unclickable, visually grayed via Task 1.1's CSS) whenever
  `existingId` is `null` and no id has been assigned yet this
  session** — exactly the real device's `(*) Save the user to enable
  editing of all fields` behavior; reuse that exact footnote string
  under the General tab's Save button when in "locked" state.
- Once the id exists (either because `existingId` was passed in for an
  Edit, or because the General tab's create just succeeded), all tabs
  are enabled and behave exactly as today's `openEditor` already does
  (no logic change to any of the group/card/image/PIN/administrator
  API calls themselves — this task only changes how they're
  presented, not what they call).
- The "Add User" button (currently opening the plain inline
  `addForm`) now calls `openUserModal(null)`; each row's "Edit" button
  calls `openUserModal(user.id)` (same as today's `openEditor(user.id)`
  call site).
**Verification:** `node --check frontend/users.js`; manual local check
(Task 6.1) that opening "Add User" shows all 5 tabs with 4 disabled
and the footnote text, and that after a successful General-tab Save
the other tabs become clickable without closing/reopening the dialog.
**Pass:** Exit 0; tab-lock behavior matches the real device's
confirmed pattern exactly.
**Fail:** Compile error, tabs not disabled pre-save, or any existing
group/card/image/PIN/administrator API call behavior changed
(regression against Giai đoạn 2b/5's already-verified logic).

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Access Logs / System Information: minor shell adjustments

### Task 4.1 — `frontend/access-logs.js`: table styling class adjustments
**Action:** Adjust only class names/markup as needed to fit Task
1.1's new table CSS (e.g. if the table needs a wrapping class the new
CSS expects) — no change to the actual data-fetching/rendering logic
or the `/access-logs` API call.
**Verification:** `node --check frontend/access-logs.js`.
**Pass:** Exit 0; visually consistent with the new table style (Task
6.x).
**Fail:** Compile error, or any change to the actual API call/fields
rendered.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — `frontend/system-info.js`: shell class adjustments
**Action:** Same as Task 4.1, for the System Information tab's `<dl>`
rendering — markup/class only, no logic change.
**Verification:** `node --check frontend/system-info.js`.
**Pass:** Exit 0.
**Fail:** Compile error, or any change to the actual API call/fields
rendered.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Docs

### Task 5.1 — `docs/src-map.md`: note the visual redesign
**Action:** Update the existing "Frontend" section's row(s) to note
the visual redesign (real-device-matched theme, tabbed Add/Edit
modal) — don't duplicate existing rows, extend them.
**Verification:** Manual review.
**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 6 — Manual visual verification (GATED for the write portion)

### Task 6.1 — Local visual check: shell, login, table, tab-lock (read-only parts)
**Action:** Start `amico_backend` locally (no live-device approval
needed yet — this is a login the project already does routinely with
standing access, same as every prior manual frontend check this
session). Confirm: sidebar shell renders correctly; login split-screen
matches the captured reference; Users table shows icon-based booleans
and real photos still render (regression check against the
already-fixed photo bug); opening "Add User" shows all 5 tabs with 4
visibly disabled + the footnote text.
**Verification:** Manual, operator/agent-observed via
chrome-devtools-mcp, screenshots compared against the live-capture
reference screenshots already saved this session.
**Pass:** Visual structure matches; no console errors; existing
functional regressions checked (login, users list, photos, access
logs, system information all still work exactly as before — this plan
changes no backend behavior).
**Fail:** Any visual breakage, console error, or functional
regression.

**Status:** `[x]` — 2026-09-13, verified by Claude directly (not just
Codex's own report) via chrome-devtools-mcp against the real device
(`http://192.168.2.156`). Screenshots taken and visually compared: login
split-screen matches the captured reference closely (gradient panel,
rounded corner, white card); sidebar shell renders correctly with
active-item accent; Users table shows inline-SVG check/X icons with
correct `aria-label`s (confirmed via snapshot: "Not set"/"Set"/"No");
all 3 existing real users' photos still render correctly (regression
check against the photo-display fix — PASS, no re-break); Access Logs
and System Information tabs both render correctly under the new shell,
no functional change. Opening "Add User" showed exactly the 5 expected
tabs (General enabled, Groups/Cards/PIN/Facial visibly `disabled`) with
the exact footnote text "(*) Save the user to enable editing of all
fields" in red — matches the real device's own confirmed behavior.
Dialog closed via "Close" without submitting (no write performed). No
console errors observed. One cosmetic, non-code oddity noticed (two
user names rendered with a transient blue/underline appearance in a
screenshot) — confirmed via `getComputedStyle` to be `color: #222` /
`text-decoration: none` in the actual DOM, i.e. not caused by this
project's CSS/JS; not investigated further as a browser-chrome-level
rendering artifact, not a real defect.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 6.2 — Tab-unlock behavior on a real create (GATED — write action)
**Action:** **Before running:** obtain a fresh, distinct
`APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval — this is this
plan's only write action anywhere (creating one disposable test user
to observe the tabs unlock, same disposable-test-user discipline as
every prior write test this project has run: never a real user,
deleted afterward). Open "Add User", fill Name only, submit the
General tab, confirm the dialog stays open with the other 4 tabs now
enabled (no page reload, no dialog close/reopen), confirm the table
now shows the new user. Delete the disposable user afterward.
**Verification:** Manual, operator/agent-observed.
**Pass:** Tabs unlock in place exactly as the real device does; no
real user affected; test user deleted afterward, confirmed via a
fresh `GET /users` check.
**Fail:** Any deviation, or a real user affected.

**Status:** `[x]` — 2026-09-13, PASS live against
`http://192.168.2.156` (fresh `APPROVE_LIVE_DEVICE_WRITE_TEST`
approval received). Created disposable test user
`ZZ_TabUnlockTest` (id 47) via the General tab. Confirmed: the SAME
dialog instance (no close/reopen) updated its title to "Edit
ZZ_TabUnlockTest", all 4 tabs (Groups/Cards/PIN/Facial) changed from
`disabled` to enabled in place, status message read exactly "User
created. All tabs are now available." Clicked into the Facial tab and
confirmed it rendered fully (Choose File/Remove Image controls
present). Closed the dialog; table showed the new user (id 47). Test
user deleted afterward; a fresh snapshot confirmed only the original 3
real users (5, 36, 4) remain.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 1-5 tasks marked `[x]`
- [x] Group 6 complete, or explicitly "not run this cycle — no
      live-device approval issued" (Task 6.1 alone, being read-only-
      login-only, does not require the write-tier approval; only Task
      6.2 does)
- [x] No tasks marked `[!]`
- [x] No real HID/Amico logo or brand asset used anywhere (grep the
      `frontend/` tree for "HID" and any copied image filename from
      the device — must find nothing)
- [x] `docs/src-map.md` updated (Task 5.1)
- [x] `sprint-summary.md` written

---

## Rollback procedure

`frontend/style.css`, `frontend/index.html`, `frontend/users.js`,
`frontend/login.js`, `frontend/access-logs.js`, `frontend/system-
info.js` are all modifications to existing, already-working files —
revert via `git diff`/`git checkout --` against this plan's own
changes if needed (check `git status` first per standing safety
practice).

## Execution verification ? 2026-09-13

Groups 1?5 implemented and checked within the user's delegated scope. All
JavaScript syntax checks pass, static HTML checks preserve every original ID
and the three nav data-tab/aria-controls pairs, and 23 automated headless Chrome
checks pass using local files and mocked fetch responses (no backend/device).
CSS received source review, token/brace sanity checks, and browser computed-style
checks. This is not a claim of complete visual acceptance.

**Group 6 not run this cycle ? explicitly excluded by the user; no live-device
write approval issued.** Tasks 6.1 and 6.2 remain unchecked. Their visual/live
acceptance criteria are deferred; Group 1?5 completion records implementation
and offline verification only. See DECISION_LOG.md for plan discrepancies and
sprint-summary.md for exact results.
