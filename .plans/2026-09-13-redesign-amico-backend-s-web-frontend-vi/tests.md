# Tests — Redesign the web frontend to match the real AMICO device's look and feel

> **Executor instructions:** Run every test after all tasks complete.
> Task 6.2 (live write) is conditional on a separate, fresh
> `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval. Fill in each
> **Result:** line as each test actually runs; do not pre-fill.

---

## Syntax gate (run first — if this fails, stop immediately)

```bash
node --check frontend/app.js
node --check frontend/login.js
node --check frontend/users.js
node --check frontend/access-logs.js
node --check frontend/system-info.js
```
**Pass:** All exit 0.
**Fail:** Any syntax error → report to Planner before proceeding.
**Result:**
> PASS: all 5 files exit 0 (re-run independently by Claude, not just
> taken from Codex's report).

---

## Functional tests

### Test F-1 — No trademarked assets anywhere in `frontend/`
```bash
grep -rni "hid global\|assa abloy" frontend/
grep -rn "logoW\|logo_div\|/images/" frontend/
```
**Pass:** No output from either command (no copied device brand text
or image reference).
**Fail:** Any match.
**Result:**
> PASS: both commands produced empty output.

---

### Test F-2 — Design tokens present and traceable to the live capture
```bash
grep -c "0057B7\|002D56\|003087" frontend/style.css
```
**Pass:** At least one match for each of the three hex values (or
their exact CSS-custom-property equivalents), confirming the tokens
were actually used, not just described in the plan.
**Fail:** Zero matches for any of the three.
**Result:**
> PASS: `grep -c` reports 3 (all three hex values present as `:root`
> custom properties).

---

### Test F-3 — Existing element ids/attributes `app.js`/`login.js` depend on are preserved
```bash
grep -c 'data-tab=' frontend/index.html
grep -c 'id="login-view"\|id="login-form"\|id="login-device"\|id="login-username"\|id="login-password"\|id="login-remember"\|id="login-submit"' frontend/index.html
grep -c 'id="connected-device"\|id="logout"' frontend/index.html
```
**Pass:** All three counts are non-zero and match the expected number
of occurrences (3 `data-tab` buttons, all 6 login-form ids, both
connected-device/logout ids).
**Fail:** Any missing id/attribute `app.js`/`login.js` reads.
**Result:**
> PASS: `data-tab` count 3; login-form ids count 7 (7 matching lines,
> all present); connected-device/logout count 1 line (both ids share
> one line — manually confirmed both `id="connected-device"` and
> `id="logout"` are present verbatim in `frontend/index.html:15`).

---

### Test F-4 — Users modal: 5 tabs, 4 locked pre-save, matching real-device footnote text
Manual check (no automated DOM-testing framework in this project, same
accepted limitation as Giai đoạn 4):
**Pass:** Opening "Add User" shows tab buttons General/Groups/Cards/
PIN/Facial; only General is enabled; the other 4 are visually
disabled and unclickable; the footnote text (matching the real
device's own wording) is visible.
**Fail:** Wrong tab set, tabs not locked, or footnote missing.
**Result:**
> PASS (live, against the real device): snapshot confirmed exactly
> `tab "General" selected`, `tab "Groups" disabled`, `tab "Cards"
> disabled`, `tab "PIN" disabled`, `tab "Facial" disabled`, and the
> exact text "(*) Save the user to enable editing of all fields"
> present. Dialog closed via Close without submitting.

---

### Test F-5 — Icon-based boolean columns are accessible
```bash
grep -n "aria-label\|sr-only\|visually-hidden" frontend/users.js
```
**Pass:** Icon-only boolean cells (Password, Administrator) have an
accessible text equivalent, not purely a colored icon with no label.
**Fail:** An icon-only cell with no accessible text found anywhere.
**Result:**
> PASS: `aria-label` present on the boolean icon `<span>` (line 48),
> confirmed live via snapshot showing `image "Set"`/`image "Not
> set"`/`image "No"` accessible names for the Password/Administrator
> columns.

---

### Test F-6 — Regression: existing photo-display fix still works
Manual check against the currently-running backend (no new user
needed — reuses the 3 existing real users, id 5/36/4, already known to
have photos per the prior plan's live verification):
**Pass:** All three still render their real photos (not "No image"),
confirming this redesign didn't regress the `GET /users/:id/image`
proxy route's frontend consumption.
**Fail:** Any of the three now shows "No image" or a broken-image icon.
**Result:**
> PASS (live): all 3 real users (5 "Phat", 36 "Phuong Hoang", 4 "Trung
> Dung") rendered their real photos correctly under the new theme —
> confirmed via snapshot (`image "Photo of ..."` nodes present, no
> placeholder fallback triggered).

---

## Live tests (GATED — separate, fresh approval required for the write portion)

### Test L-1 — Full visual check against the real device (read-only: login, list, tabs pre-save)
**Setup:** Standard login against `http://192.168.2.156` (this
project's routine access, not a new approval category).
**Pass:** Sidebar shell, header, login split-screen, table icons, and
the Users modal's tab-lock-before-save state all visually match the
captured reference (`captures/screenshots/` from this session's
discovery pass). No console errors.
**Fail:** Any visual mismatch traceable to a real implementation
defect (not a deliberate Decision 2 trademark omission), or any
console error.
**Result:**
> PASS — see Task 6.1's detailed result in `tasks.md` for the full
> evidence chain (screenshots, snapshots, all three existing tabs
> checked, no console errors, one cosmetic non-code rendering
> oddity noted and ruled out via `getComputedStyle`).

---

### Test L-2 — Tab-unlock behavior on a real create (write action)
**Setup:** `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` received as a
fresh, distinct message.
**Pass:** Creating a disposable test user via the General tab unlocks
the other 4 tabs in place (no dialog close/reopen); test user deleted
afterward; a fresh `GET /users` confirms only the original real users
remain.
**Fail:** Tabs don't unlock, a real user is affected, or the test user
isn't cleaned up.
**Result:**
> PASS (2026-09-13, live): created `ZZ_TabUnlockTest` (id 47); same
> dialog instance updated title and unlocked all 4 extra tabs in
> place; Facial tab confirmed fully rendered; test user deleted
> afterward, confirmed via snapshot showing only the original 3 real
> users remain.

---

## Regression tests (ensure nothing broke)

### Test R-1 — Backend/SDK offline suites entirely unaffected (this plan touches no backend/SDK file)
```bash
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** Same counts as before this plan (SDK 95/517, backend
41/476, per the most recent prior plan's baseline) — this plan is
frontend-only and must not change either number.
**Fail:** Any count change.
**Result:**
> PASS: SDK 95 cases / 517 assertions (unchanged); backend 41 cases /
> 476 assertions (unchanged) — re-run independently by Claude.

---

### Test R-2 — Existing frontend functional behavior unchanged (Access Logs, System Information, Logout)
Manual check:
**Pass:** Access Logs still lists real entries; System Information
still shows real device fields; Logout still returns to the login
view and ends the session — all matching pre-redesign behavior
exactly, only the visual presentation differs.
**Fail:** Any functional regression.
**Result:**
> PASS (live): Access Logs showed 50 real entries with working
> filters; System Information showed all real device fields (serial,
> firmware, network, etc.); Logout correctly returned to the login
> view.

---

## Sprint sign-off

- [x] Syntax gate
- [x] Functional tests F-1 through F-6
- [x] Live test L-1 (read-only)
- [x] Live test L-2 (write) — PASS, fresh
      `APPROVE_LIVE_DEVICE_WRITE_TEST` approval received and executed
- [x] All regression tests
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written

**Sign-off date:** 2026-09-13 — full plan complete (Groups 1-5 + Task
6.1 + Task 6.2, all PASS)
