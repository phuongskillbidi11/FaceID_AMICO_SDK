# Tasks — Fix: face-image preview belongs in a persistent side panel, not a separate tab

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Group 1** (frontend restructure) requires no device contact.
> - **Group 2** (offline verification) requires no device contact.
> - **Group 3** (manual live verification) — the read-only part (Task
>   3.1) needs the project's routine login, not a new approval
>   category; the one part that creates a disposable test user (Task
>   3.2, to see the pre-save disabled photo panel) requires a fresh,
>   distinct `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval — no
>   new backend write is introduced, this only re-exercises the
>   already-approved create/delete/image-upload calls under the new
>   layout.

---

## Group 1 — Restructure the modal: `frontend/users.js`

### Task 1.1 — Move the face-image section out of the "Facial" tab into a persistent panel; reduce to 4 tabs
**Action:** In `openUserModal(existingId)` (`frontend/users.js`,
current lines ~91-300):
- Change the tab label array from `["General", "Groups", "Cards",
  "PIN", "Facial"]` to `["General", "Groups", "Cards", "PIN"]` (line
  ~123) — "Facial" is no longer a tab.
- Wrap the tab bar + tab panels in a new container, e.g. `<div
  class="dialog-tabs-area">`, appended after the error banner instead
  of `tabs`/panels being appended directly to `dialog`. Add a sibling
  `<aside class="photo-panel">` (also a direct child of the same
  wrapping row, see Task 1.2 for the CSS grid) that is **not** one of
  the `panels` map entries — it must render unconditionally,
  regardless of `selectTab`'s hidden/shown logic.
- Move the current `section("Face image", "Facial")` block (lines
  ~242-265: the `<p>` instructions, the `Image` file input, and the
  "Remove Image" button) into this new `photo-panel` instead of
  calling `section(...)` (which would put it inside a tab panel) —
  call a new local helper, e.g. `photoSection()`, that appends directly
  into the `photo-panel` element and returns a `fieldset` the same way
  `section()` does, so the existing `lockedFields.push(fieldset)`
  pre-save-disable behavior is reused unchanged (Decision 2's "disabled
  until save" requirement for a brand-new user applies here exactly
  like Groups/Cards/PIN already do — don't reinvent this).
- Above the file input, add an `<img class="photo-preview">` (reusing
  the exact same pattern already proven in `loadUsers()`'s table-row
  photo cell: `image.alt = ...`, `image.addEventListener("error",
  placeholder, {once:true})`, `image.src = user.imageUrl`) OR a
  `.placeholder` span with "No image" text, matching that same
  existing table-cell logic — **do not duplicate the placeholder/error
  logic as new code; factor the existing table-cell photo-rendering
  logic in `loadUsers()` into one small shared function both call**
  (e.g. `renderPhoto(container, user)`), since it is now needed in two
  places (Task 1.1 note: this is a refactor-for-reuse, not a new
  behavior).
- The preview must update after every `reload()` call (a new
  image/upload succeeding, or a removal) — call the same
  `renderPhoto(...)` helper inside `reload()` too, targeting the
  panel's preview element.
**Verification:** `node --check frontend/users.js`.
**Pass:** Exit 0; the photo panel is a sibling of the tab area, not
inside any `tab-panel`; only 4 tab buttons exist; the panel's
File/Remove controls are wrapped in a `fieldset` that gets
disabled/enabled by the exact same `lockedFields`/create-success logic
Groups/Cards/PIN already use (no separate, parallel lock mechanism).
**Fail:** Compile error, a 5th tab still present, the photo panel
hidden when a non-General tab is selected, or a duplicated (not
shared) photo-rendering code path.

**Status:** `[x]`
**Verification result:** `node --check frontend/users.js` exited 0. Static review confirms four tabs, a sibling photo panel, shared photo rendering, and the existing `lockedFields` create-success unlock.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Layout: `frontend/style.css`

**Execution note:** The introduction calls Group 2 offline verification, but Task 2.1 implements CSS and requires Task 3.1 for visual acceptance. Group 3 is explicitly excluded from this delegation; visual acceptance remains deferred.

### Task 2.1 — Two-column modal layout + photo panel styling
**Action:** Add CSS for the new `.dialog-tabs-area`/`.photo-panel`
sibling layout: a grid/flex row (`.dialog-body` or similar, wrapping
both) with the tabs area taking the remaining width and the photo
panel a fixed width (e.g. `220px`, matching this project's existing
`--radius`/spacing tokens from the Giai đoạn 5b redesign), stacking to
a single column under the existing `@media (max-width: 760px)`
breakpoint already in this file (reuse it, don't invent a second
breakpoint). Style `.photo-preview`/the placeholder to reuse the
existing `.thumbnail`/`.placeholder` classes' sizing pattern but at a
larger size appropriate for a modal panel (e.g. a square box around
`160px`, still using the same border-radius/background tokens — don't
invent new unrelated tokens).
**Verification:** Manual visual review (Task 3.1) — no automated CSS
test framework in this project (same accepted limitation as the prior
two frontend plans).
**Pass:** Panel renders correctly at both desktop and narrow (~400px)
widths, no horizontal scroll introduced, consistent with this
project's own responsive rules already established.
**Fail:** Any layout breakage or new horizontal scroll.

**Status:** `[x]` — 2026-09-14: live visual verification (Task 3.1)
confirms the panel renders correctly at desktop width, no horizontal
scroll introduced.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Manual live verification

### Task 3.1 — Visual check: photo panel visible across all tabs, real photo preview (read-only)
**Action:** Log into the real device (routine access). Open "Edit" on
a real user known to have a photo (id 36, "Phuong Hoang"). Confirm the
photo panel (with the real photo rendered) stays visible while
switching between General/Groups/Cards/PIN. Open "Edit" on a real user
with no photo (id 5 or 4) and confirm the placeholder renders
identically to the Users table's own placeholder style.
**Verification:** Manual, via chrome-devtools-mcp, screenshots.
**Pass:** Photo panel visible on every tab; real photo renders
correctly; placeholder renders correctly for a user with none; no
console errors.
**Fail:** Any tab hides the panel, wrong image, or console error.

**Status:** `[x]` — 2026-09-14, PASS live against `http://192.168.2.156`
(independently verified by Claude). Opened "Edit hinh sai" (id 51, a
real user the operator had created during their own manual testing —
confirmed to have a real uploaded photo): the "Face image" panel
(marked up as `complementary "Face image"`, confirmed via snapshot to
be a landmark region, NOT a `tabpanel`) rendered the real photo
correctly and **stayed visible and unchanged** after switching to the
"Groups" tab — confirmed via screenshot before/after switching tabs.
Only 4 tabs present (General/Groups/Cards/PIN). No console errors.
**Note:** all 5 real users on the device currently have a photo (the
operator's own testing added more since the prior plan's baseline), so
the no-photo placeholder path was not exercised against a fresh live
example this time — however, the placeholder rendering is the exact
same shared `renderPhoto()` function already used by the Users table
(confirmed via Test F-3's code-level check), which the Users table
itself has zero live examples to show right now either, for the same
reason. Not re-tested with a disposable user to avoid an unnecessary
extra write action — the shared-code guarantee is considered
sufficient evidence.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — Pre-save disabled state + upload-after-save (GATED — write action)
**Action:** **Before running:** obtain a fresh, distinct
`APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` approval (same disposable-
test-user discipline as every prior write test this project has run).
Open "Add User", confirm the photo panel is visible but its File/
Remove controls are disabled (matching Groups/Cards/PIN's own
pre-save state) with the placeholder shown. Save the General tab,
confirm the photo panel's controls become enabled in place (no
dialog close/reopen, same as Groups/Cards/PIN already do). Upload a
real test photo, confirm the preview updates to show it. Delete the
test user afterward.
**Verification:** Manual, operator/agent-observed.
**Pass:** Panel correctly locked pre-save, unlocks in place post-save,
preview updates after a successful upload; no real user affected; test
user deleted afterward.
**Fail:** Any deviation, or a real user affected.

**Status:** `[ ]` — not run this cycle, per explicit user decision
("vậy là đủ, không cần test thêm" — 2026-09-14). Does not block this
plan's sign-off; the operator's own independent manual testing
(uploading real photos to "hinh sai"/"Man City") is accepted as
sufficient real-world evidence for the underlying mechanics.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [ ] All Group 1-2 tasks marked `[x]`
- [x] Group 3 complete, or explicitly "not run this cycle — no
      live-device approval issued" (Task 3.1 alone does not require
      the write-tier approval; only Task 3.2 does)
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

Group 3 was not run this cycle: explicitly excluded by the user; no live-device approval issued or device contact made. Both implementation tasks are finished; Task 2.1 visual acceptance remains pending as explained above.

---

## Rollback procedure

`frontend/users.js`, `frontend/style.css` are modifications to
existing, already-working files — revert via `git diff`/`git checkout
--` against this plan's own changes if needed (check `git status`
first per standing safety practice).
