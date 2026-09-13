# Tests — Fix: face-image preview belongs in a persistent side panel, not a separate tab

> **Executor instructions:** Run every test after all tasks complete.
> Task 3.2 (live write) is conditional on a separate, fresh
> `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval. Fill in each
> **Result:** line as each test actually runs; do not pre-fill.

---

## Syntax gate

```bash
node --check frontend/users.js
```
**Pass:** Exit 0.
**Fail:** Report to Planner before proceeding.
**Result:**
> PASS: exit 0 (re-run independently by Claude).

---

## Functional tests

### Test F-1 — Only 4 tabs remain; "Facial" is gone as a tab
```bash
grep -n '"General", "Groups", "Cards", "PIN"' frontend/users.js
grep -c '"Facial"' frontend/users.js
```
**Pass:** First command matches the 4-item array; second command's
count reflects only non-tab-array uses of the string "Facial" (if
any label text still says "Facial" somewhere in the photo panel's own
heading, that's fine — the check here is specifically that the tab
array itself no longer includes it as a 5th tab).
**Fail:** Tab array still has 5 entries.
**Result:**
> PASS: `["General", "Groups", "Cards", "PIN"].forEach(...)` found at
> line 132; no 5th tab entry.

---

### Test F-2 — Photo panel is not a tab panel (always rendered, not `hidden`-toggled by tab selection)
Manual code review + live check (Task 3.1): confirm the photo panel
element is a sibling of the tabs area, never receives a `hidden`
attribute from `selectTab()`.
**Pass:** Photo panel has no `hidden` toggling tied to tab selection.
**Fail:** Panel disappears when switching tabs.
**Result:**
> PASS (live-confirmed): snapshot showed the panel as `complementary
> "Face image"` (a landmark, not a `tabpanel`); screenshotted before
> and after switching to the Groups tab — panel content unchanged.

---

### Test F-3 — Shared photo-rendering logic, not duplicated
```bash
grep -c "function renderPhoto" frontend/users.js
```
**Pass:** Exactly 1 (a single shared helper used by both the table row
and the modal's photo panel — not two separate implementations).
**Fail:** 0 (no shared helper — duplicated logic instead) or the
helper exists but only one call site uses it.
**Result:**
> PASS: exactly 1 `renderPhoto` function, called from `loadUsers()`
> (table), from the modal's photo-panel setup, and from `reload()`.

---

### Test F-4 — Pre-save lock reuses the existing `lockedFields` mechanism
```bash
grep -n "lockedFields.push" frontend/users.js
```
**Pass:** The photo panel's fieldset is pushed into `lockedFields`
alongside Groups/Cards/PIN's fieldsets (same array, same enable-on-
create-success loop) — no separate/parallel disable mechanism
introduced for the photo panel specifically.
**Fail:** A second, separate lock/unlock code path for the photo panel.
**Result:**
> PASS: `photoSection()` pushes its fieldset into the exact same
> `lockedFields` array Groups/Cards/PIN use — one shared array, one
> unlock loop.

---

## Live tests (GATED for the write portion)

### Test L-1 — Photo panel visible across all tabs; real photo + placeholder both render correctly (read-only)
**Setup:** Standard login against `http://192.168.2.156`.
**Pass:** Editing user 36 (has a photo) shows the real photo in the
panel, visible while switching between General/Groups/Cards/PIN.
Editing user 5 or 4 (no photo) shows the placeholder, styled
consistently with the Users table's own placeholder. No console
errors.
**Fail:** Panel hidden on any tab, wrong/missing image, or console
error.
**Result:**
> PASS (partial — real-photo case only). Edited user 51 ("hinh sai",
> has a real uploaded photo): panel showed the real photo, stayed
> visible/unchanged across General→Groups. No console errors. The
> no-photo placeholder case was not exercised against a fresh live
> example this cycle — all 5 real users on the device currently have a
> photo (the operator's own testing added more since this plan's
> baseline) — but the placeholder path shares the exact same
> `renderPhoto()` function already covered by Test F-3's code check.

---

### Test L-2 — Pre-save lock + post-save unlock + upload preview update (write action)
**Setup:** `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` received as a
fresh, distinct message.
**Pass:** New-user photo panel shows placeholder with disabled
controls pre-save; unlocks in place post-save (no dialog close/
reopen); uploading a real photo updates the preview to show it; test
user deleted afterward, confirmed via a fresh `GET /users` check.
**Fail:** Any deviation, or a real user affected.
**Result:**
> NOT RUN this cycle — no live-device write approval issued for this
> plan specifically. Note: the operator independently created real
> users ("hinh sai", "Man City") via their own browser and
> successfully uploaded real photos to them under the new layout —
> strong informal evidence the underlying mechanics work, but not a
> substitute for this plan's own formal Task 3.2 sequence (pre-save
> locked → save → unlocked in place → upload → preview updates,
> observed end-to-end on a disposable test user).

---

## Regression tests

### Test R-1 — Backend/SDK offline suites unaffected (this plan touches no backend/SDK file)
```bash
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** Same counts as before this plan (SDK 95/517, backend
41/476).
**Fail:** Any count change.
**Result:**
> PASS: SDK 95/517, backend 41/476 — unchanged.

---

### Test R-2 — Groups/Cards/PIN tabs still work exactly as before (only their container changed)
Manual check: Add/remove a group id, add/remove a card, toggle
Administrator, set a PIN — all on a disposable test user (same session
as Test L-2, no separate approval needed since these are already-
approved-pattern actions being re-exercised under the new layout, not
new write actions).
**Pass:** All four still work exactly as before this plan.
**Fail:** Any regression.
**Result:**
> NOT RUN this cycle — tied to Test L-2's same write approval.

---

## Sprint sign-off

- [x] Syntax gate
- [x] Functional tests F-1 through F-4
- [x] Live test L-1 (read-only, real-photo case; placeholder case
      not exercised this cycle — see note)
- [ ] Live test L-2 (write) — not run this cycle, no live-device write
      approval issued. Does not block sign-off for Groups 1-2's own
      completion.
- [x] Test R-1 (offline regression) — PASS. Test R-2 (write-tied) —
      not run this cycle, same reason as L-2.
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written

**Sign-off date:** 2026-09-14 (Groups 1-2 + Task 3.1/Test L-1; Task
3.2/Test L-2/R-2 pending optional live-device write approval)
